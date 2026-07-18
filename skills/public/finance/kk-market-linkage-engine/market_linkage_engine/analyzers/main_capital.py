"""
1. 主力资金流向分析器

数据源：Tushare Pro moneyflow / moneyflow_dc / moneyflow_ind_ths
+ 同花顺问财（实时补充，可选）

输出维度：
  - 个股主力资金净流入 TOP N
  - 行业/板块资金流向分布
  - 主力 vs 散户资金分歧度
  - 全市场资金净额 & 信号评分
"""
from __future__ import annotations

from typing import Dict, Any, Optional

import pandas as pd

from .base import BaseAnalyzer
from ..utils import yi, pct_str, signal_cn, md_table, safe_div
from ..config import (
    MAIN_CAPITAL_TOP_SECTORS,
    MAIN_CAPITAL_TOP_STOCKS,
    DATA_SOURCE_TUSHARE,
    DATA_SOURCE_IWENCAI,
)


class MainCapitalAnalyzer(BaseAnalyzer):
    name = "主力资金流向"
    dim_key = "main_capital"

    def analyze(
        self, trade_date: str, days: int = 1, top_n: int = MAIN_CAPITAL_TOP_STOCKS
    ) -> Dict[str, Any]:
        res = self._result_template()
        res["data_source"] = DATA_SOURCE_TUSHARE
        if self.fetcher is None:
            return res

        # 1) 个股主力资金
        stocks = self.fetcher.fetch_main_capital_stocks(trade_date)
        # 2) 板块（大单）资金
        sector = self.fetcher.fetch_main_capital_sector(trade_date)
        # 3) 同花顺行业资金（备用）
        ind_ths = self.fetcher.fetch_main_capital_industry_ths(trade_date)

        detail: Dict[str, Any] = {"trade_date": trade_date}

        # ----- 个股维度 -----
        if len(stocks):
            net_col = "net_amount" if "net_amount" in stocks.columns else None
            if net_col is None:
                # moneyflow 接口可能用 active_net_amount 等列
                for cand in ("net_mf_amount", "active_net_amount"):
                    if cand in stocks.columns:
                        net_col = cand
                        break
            if net_col:
                stocks[net_col] = pd.to_numeric(stocks[net_col], errors="coerce")
                in_count = int((stocks[net_col] > 0).sum())
                out_count = int((stocks[net_col] < 0).sum())
                # Tushare moneyflow returns net_amount in 万元; convert to 元 for yi()
                stocks[net_col] = stocks[net_col] * 1e4
                stock_cols = [c for c in ("ts_code", "name", net_col) if c in stocks.columns]
                top_in = (
                    stocks[stocks[net_col] > 0]
                    .sort_values(net_col, ascending=False)
                    .head(top_n)[stock_cols]
                )
                top_out = (
                    stocks[stocks[net_col] < 0]
                    .sort_values(net_col, ascending=True)
                    .head(top_n)[stock_cols]
                )
                detail.update({
                    "in_count": in_count,
                    "out_count": out_count,
                    "top_in": top_in.to_dict("records"),
                    "top_out": top_out.to_dict("records"),
                })

        # ----- 板块维度 -----
        # The sector data (moneyflow) includes ALL stocks — use its sum as the
        # full-market total net, not just the top-N stocks fetched above.
        sector_df = sector if len(sector) else (ind_ths if len(ind_ths) else pd.DataFrame())
        if len(sector_df):
            sector_net_col = None
            for cand in ("net_amount", "net_mf_amount"):
                if cand in sector_df.columns:
                    sector_net_col = cand
                    break
            name_col = "name" if "name" in sector_df.columns else None
            if sector_net_col:
                sector_df[sector_net_col] = pd.to_numeric(sector_df[sector_net_col], errors="coerce")
                # Full-market net = sum of all stock net amounts.
                # Tushare moneyflow returns net_amount in 万元 (10k yuan).
                total_net_wan = float(sector_df[sector_net_col].sum())
                total_net_yi = total_net_wan / 1e4  # 万 → 亿
                detail["total_net"] = total_net_wan * 1e4  # 万元 → 元
                detail["total_net_yi"] = total_net_yi
                if total_net_yi > 0:
                    flow_label = "流入"
                elif total_net_yi < 0:
                    flow_label = "流出"
                else:
                    flow_label = "平衡"
                res["signals"].append(
                    f"全市场主力资金净{flow_label} "
                    f"{total_net_yi:+.1f}亿，净流入个股 {detail.get('in_count', '?')} vs 净流出 {detail.get('out_count', '?')}"
                )
                # Tushare moneyflow_dc returns net_amount in 万元; convert to 元 for yi()
                sector_df[sector_net_col] = sector_df[sector_net_col] * 1e4
                sector_cols = [c for c in (name_col, sector_net_col) if c]
                top_sec_in = (
                    sector_df[sector_df[sector_net_col] > 0]
                    .sort_values(sector_net_col, ascending=False)
                    .head(MAIN_CAPITAL_TOP_SECTORS)[sector_cols]
                )
                top_sec_out = (
                    sector_df[sector_df[sector_net_col] < 0]
                    .sort_values(sector_net_col, ascending=True)
                    .head(MAIN_CAPITAL_TOP_SECTORS)[sector_cols]
                )
                detail["top_sectors_in"] = top_sec_in.to_dict("records")
                detail["top_sectors_out"] = top_sec_out.to_dict("records")

        # ----- 评分 -----
        # total_net is now in 元 (converted from 万元 before storing in detail).
        # total_net_yi is the preferred field for scoring (already in 亿).
        total_net = detail.get("total_net", 0.0)
        total_net_yi = detail.get("total_net_yi", total_net / 1e8 if total_net else 0)
        score = 50
        if total_net_yi > 50:
            score = 75; res["bias"] = "bullish"
            res["signals"].append("🟢 主力大幅净流入，做多意愿强烈")
        elif total_net_yi > 10:
            score = 60; res["bias"] = "bullish"
            res["signals"].append("🟢 主力小幅净流入")
        elif total_net_yi < -50:
            score = 25; res["bias"] = "bearish"
            res["signals"].append("🔴 主力大幅净流出，谨慎情绪浓厚")
        elif total_net_yi < -10:
            score = 40; res["bias"] = "bearish"
            res["signals"].append("🔴 主力小幅净流出")
        else:
            score = 50; res["bias"] = "neutral"
            res["signals"].append("⚪ 主力资金净额接近平衡")

        res["score"] = score
        if total_net > 0:
            flow_label = "流入"
        elif total_net < 0:
            flow_label = "流出"
        else:
            flow_label = "平衡"
        res["summary"] = (
            f"主力资金净{flow_label} {yi(total_net)}，"
            f"信号 {signal_cn(total_net)}（评分 {score}）"
        )
        res["detail"] = detail
        return res

    def to_markdown(self, result: Dict[str, Any]) -> str:
        d = result["detail"]
        lines = [f"### 1. {self.name}（{d.get('trade_date','')}）", ""]
        lines.append(f"**综合评分：** {result['score']}/100  | **偏向：** {result['bias']}")
        lines.append(f"**结论：** {result['summary']}")
        lines.append("")
        if "total_net" in d:
            lines.append(
                f"- 全市场主力净额：**{yi(d['total_net'])}** "
                f"（净流入 {d.get('in_count','-')} 只 / 净流出 {d.get('out_count','-')} 只）"
            )
        if d.get("top_sectors_in"):
            lines.append("\n**流入板块 TOP：**")
            df = pd.DataFrame(d["top_sectors_in"]).head(MAIN_CAPITAL_TOP_SECTORS)
            value_col = next((c for c in ("net_amount", "net_mf_amount") if c in df.columns), None)
            lines.append(md_table(
                df,
                formatters={value_col: yi} if value_col else None,
                rename={"name": "板块", "net_amount": "净额", "net_mf_amount": "净额"},
            ))
        if d.get("top_sectors_out"):
            lines.append("\n**流出板块 TOP：**")
            df = pd.DataFrame(d["top_sectors_out"]).head(MAIN_CAPITAL_TOP_SECTORS)
            value_col = next((c for c in ("net_amount", "net_mf_amount") if c in df.columns), None)
            lines.append(md_table(
                df,
                formatters={value_col: yi} if value_col else None,
                rename={"name": "板块", "net_amount": "净额", "net_mf_amount": "净额"},
            ))
        if d.get("top_in"):
            lines.append(f"\n**主力净流入个股 TOP {MAIN_CAPITAL_TOP_STOCKS}：**")
            df = pd.DataFrame(d["top_in"]).head(MAIN_CAPITAL_TOP_STOCKS)
            value_col = next((c for c in ("net_amount", "net_mf_amount", "active_net_amount") if c in df.columns), None)
            lines.append(md_table(
                df,
                formatters={value_col: yi} if value_col else None,
                rename={"ts_code": "证券代码", "name": "名称", "net_amount": "净额", "net_mf_amount": "净额"},
            ))
        if d.get("top_out"):
            lines.append(f"\n**主力净流出个股 TOP {MAIN_CAPITAL_TOP_STOCKS}：**")
            df = pd.DataFrame(d["top_out"]).head(MAIN_CAPITAL_TOP_STOCKS)
            value_col = next((c for c in ("net_amount", "net_mf_amount", "active_net_amount") if c in df.columns), None)
            lines.append(md_table(
                df,
                formatters={value_col: yi} if value_col else None,
                rename={"ts_code": "证券代码", "name": "名称", "net_amount": "净额", "net_mf_amount": "净额"},
            ))
        if result["signals"]:
            lines.append("\n**信号：**")
            for s in result["signals"]:
                lines.append(f"- {s}")
        return "\n".join(lines)
