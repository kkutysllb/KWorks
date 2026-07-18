"""
2. 北向资金流向分析器

数据源：Tushare Pro hsgt（沪深港通每日资金流向）+ hsgt_top10（十大成交股）
+ 同花顺问财（实时补充）

输出维度：
  - 沪股通 / 深股通 当日净买入额
  - 北向资金 N 日累计净流入趋势
  - 北向连续流入/流出信号
  - 十大成交活跃股
  - 信号评分（结合金额强度 + 连续性）
"""
from __future__ import annotations

from typing import Dict, Any, Optional

import pandas as pd

from .base import BaseAnalyzer
from ..utils import yi, signal_cn, md_table
from ..config import (
    NORTH_STRONG_IN,
    NORTH_STRONG_OUT,
    DATA_SOURCE_TUSHARE,
)


class NorthboundAnalyzer(BaseAnalyzer):
    name = "北向资金流向"
    dim_key = "northbound"

    def analyze(
        self, trade_date: Optional[str] = None, days: int = 5, top10: bool = True
    ) -> Dict[str, Any]:
        res = self._result_template()
        res["data_source"] = DATA_SOURCE_TUSHARE
        if self.fetcher is None:
            return res

        # 拉 N+缓冲 天数据，取最近 days 天
        df = self.fetcher.fetch_northbound(days=days * 2 + 5)
        if len(df) == 0:
            res["summary"] = "无北向资金数据"
            return res

        # 列名兼容：north_money / hgt / sgt
        net_col = None
        for cand in ("north_money", "north", "total_net"):
            if cand in df.columns:
                net_col = cand
                break
        if net_col is None:
            res["summary"] = "北向资金数据列缺失"
            return res

        df = df.tail(days).reset_index(drop=True)
        df = df.sort_values("trade_date").reset_index(drop=True)

        # 保证 net_col 列为数值类型
        df[net_col] = pd.to_numeric(df[net_col], errors='coerce')

        # 沪股通 / 深股通分别净额
        sh_col = next((c for c in ("hgt", "sh_money", "ggt_ss") if c in df.columns), None)
        sz_col = next((c for c in ("sgt", "sz_money", "ggt_sz") if c in df.columns), None)

        latest = df.iloc[-1]
        latest_net = float(latest[net_col])
        cum_net = float(df[net_col].sum())
        net_positive_days = int((df[net_col] > 0).sum())
        # 连续性
        streak = 0
        for v in df[net_col].iloc[::-1]:
            if (v > 0) == (latest_net > 0):
                streak += 1
            else:
                break
        streak_sign = "净流入" if latest_net > 0 else "净流出"

        detail = {
            "trade_date": latest["trade_date"].strftime("%Y%m%d"),
            # Tushare moneyflow_hsgt returns values in 万元 (10k yuan);
            # store in 元 so yi() formatter (元→亿) works correctly.
            "latest_net": latest_net * 1e4,
            "latest_net_yi": latest_net / 1e4,
            "latest_sh": float(latest[sh_col]) * 1e4 if sh_col else None,
            "latest_sz": float(latest[sz_col]) * 1e4 if sz_col else None,
            "cum_net": cum_net * 1e4,
            "cum_net_yi": cum_net / 1e4,
            "net_positive_days": net_positive_days,
            "total_days": len(df),
            "streak": streak,
            "streak_sign": streak_sign,
            "history": df[["trade_date", net_col]].assign(
                **{net_col: df[net_col].astype(float)}
            ).to_dict("records"),
        }

        # 十大成交股
        if top10:
            top = self.fetcher.fetch_northbound_top10(detail["trade_date"], market="north")
            if len(top):
                detail["top10"] = top.to_dict("records")

        # 信号评分
        # latest_net and cum_net local vars are in 万元 (from Tushare moneyflow_hsgt).
        # NORTH_STRONG_IN/OUT are in 亿. Convert: 1亿 = 10000万.
        score = 50
        signals = []
        latest_net_yi = latest_net / 1e4  # 万 → 亿
        cum_net_yi = cum_net / 1e4        # 万 → 亿
        # 单日强度
        if latest_net_yi > NORTH_STRONG_IN:
            score += 18; signals.append(f"🟢 单日大幅净流入 {latest_net_yi:.1f}亿")
        elif latest_net_yi > 0:
            score += 6; signals.append(f"🟢 单日小幅净流入 {latest_net_yi:.1f}亿")
        elif latest_net_yi < NORTH_STRONG_OUT:
            score -= 18; signals.append(f"🔴 单日大幅净流出 {latest_net_yi:.1f}亿")
        elif latest_net_yi < 0:
            score -= 6; signals.append(f"🔴 单日小幅净流出 {latest_net_yi:.1f}亿")

        # 累计趋势
        if cum_net_yi > 0:
            score += 5; signals.append(f"🟢 {len(df)}日累计净流入 {cum_net_yi:.1f}亿")
        else:
            score -= 5; signals.append(f"🔴 {len(df)}日累计净流出 {cum_net_yi:.1f}亿")

        # 连续性（连续3日以上才有信号意义）
        if streak >= 3:
            if latest_net > 0:
                score += 10; signals.append(f"🔥 北向连续 {streak} 日净流入")
            else:
                score -= 10; signals.append(f"⚠️ 北向连续 {streak} 日净流出")

        score = max(0, min(100, score))
        res["score"] = score
        res["bias"] = "bullish" if score > 55 else ("bearish" if score < 45 else "neutral")
        res["summary"] = (
            f"北向资金{streak_sign} {latest_net_yi:+.1f}亿（{len(df)}日累计 {cum_net_yi:+.1f}亿），"
            f"连续 {streak} 日，信号 {signal_cn(cum_net)}"
        )
        res["detail"] = detail
        res["signals"] = signals
        return res

    def to_markdown(self, result: Dict[str, Any]) -> str:
        d = result["detail"]
        lines = [f"### 2. {self.name}（{d.get('trade_date','')}）", ""]
        lines.append(f"**综合评分：** {result['score']}/100  | **偏向：** {result['bias']}")
        lines.append(f"**结论：** {result['summary']}")
        lines.append("")
        lines.append(f"- 当日北向净额：**{yi(d.get('latest_net', 0))}**")
        if d.get("latest_sh") is not None:
            lines.append(f"- 沪股通：{yi(d['latest_sh'])} / 深股通：{yi(d['latest_sz'])}")
        lines.append(
            f"- {d.get('total_days','-')}日累计：**{yi(d.get('cum_net',0))}** "
            f"（净流入 {d.get('net_positive_days',0)} 天 / 连续 {d.get('streak',0)} 日 {d.get('streak_sign','') }）"
        )
        if d.get("top10"):
            lines.append("\n**北向十大成交活跃股：**")
            df = pd.DataFrame(d["top10"]).head(10)
            lines.append(md_table(
                df,
                columns=[c for c in (
                    "ts_code", "name", "close", "change", "amount",
                    "net_amount", "buy_amount", "sell_amount"
                ) if c in df.columns],
                rename={
                    "ts_code": "证券代码",
                    "name": "名称",
                    "close": "最新价",
                    "change": "涨跌幅",
                    "amount": "成交额",
                    "net_amount": "净额",
                    "buy_amount": "买入额",
                    "sell_amount": "卖出额",
                },
                formatters={
                    "net_amount": yi,
                    "buy_amount": yi,
                    "sell_amount": yi,
                    "amount": yi,
                },
            ))
        if result["signals"]:
            lines.append("\n**信号：**")
            for s in result["signals"]:
                lines.append(f"- {s}")
        return "\n".join(lines)
