"""
5. 7 大期权 ETF 波动率分析器

数据源：Tushare Pro opt_daily（期权日线含隐含波动率）+ index_daily

覆盖 7 大场内期权标的 ETF：
  上证50ETF / 沪深300ETF / 中证500ETF / 中证1000ETF / 创业板ETF / 科创50ETF / 深100ETF

输出维度：
  - 各标的认购/认沽成交量比（PCR）
  - 隐含波动率 IV 水平 + IV 变化
  - 期权市场情绪（PCR + IV 综合判断）
  - 信号评分
"""
from __future__ import annotations

from typing import Dict, Any, Optional, List

import pandas as pd

from .base import BaseAnalyzer
from ..utils import pct_str, md_table
from ..config import OPTION_ETFS, OPTION_ETFS_INDEX, INDEX_NAMES, DATA_SOURCE_TUSHARE


class OptionsVolatilityAnalyzer(BaseAnalyzer):
    name = "期权 ETF 波动率"
    dim_key = "options_vol"

    def analyze(
        self, trade_date: Optional[str] = None, days: int = 5
    ) -> Dict[str, Any]:
        res = self._result_template()
        res["data_source"] = DATA_SOURCE_TUSHARE
        if self.fetcher is None:
            return res

        detail: Dict[str, Any] = {"etfs": {}}
        signals: List[str] = []
        bull = bear = 0

        for etf_code, etf_name in OPTION_ETFS.items():
            info = self._analyze_etf(etf_code, etf_name, trade_date, days)
            detail["etfs"][etf_code] = info
            if info:
                pcr = info.get("pcr", 1.0)
                if pcr < 0.7:       # 认购活跃，偏多
                    bull += 1
                    signals.append(f"🟢 {etf_name} PCR={pcr:.2f}，认购活跃偏多")
                elif pcr > 1.3:     # 认沽活跃，偏空/避险
                    bear += 1
                    signals.append(f"🔴 {etf_name} PCR={pcr:.2f}，认沽活跃避险情绪")

        total = len(OPTION_ETFS)
        if bull > bear:
            score = 50 + 8 * (bull - bear); bias = "bullish"
        elif bear > bull:
            score = 50 - 8 * (bear - bull); bias = "bearish"
        else:
            score = 50; bias = "neutral"
        score = max(0, min(100, score))
        if not signals:
            signals.append("⚪ 期权 PCR 整体中性，无明显避险或追涨情绪")

        res["score"] = score
        res["bias"] = bias
        res["summary"] = (
            f"7 大期权 ETF：{bull} 认购活跃 / {bear} 认沽活跃 / {total-bull-bear} 中性，"
            f"PCR 整体 {bias}"
        )
        res["detail"] = detail
        res["signals"] = signals
        return res

    def _analyze_etf(self, etf_code: str, etf_name: str,
                     trade_date: Optional[str], days: int) -> Dict[str, Any]:
        try:
            df = self.fetcher.fetch_option_daily(trade_date=trade_date, days=days)
        except Exception:
            df = pd.DataFrame()
        if len(df) == 0:
            return {}

        # 过滤出该 ETF 对应合约（ts_code 前缀或 underlying 符合）
        df = df.copy()
        mask = pd.Series([False] * len(df), index=df.index)
        if "underlying_symbol" in df.columns:
            mask |= df["underlying_symbol"].astype(str).str.startswith(etf_code.split(".")[0])
        if "name" in df.columns:
            mask |= df["name"].astype(str).str.contains(etf_name[:4], na=False)
        # 也按 ts_code 前缀（如 10002587 上证50ETF 期权）
        df_etf = df[mask] if mask.any() else df
        if len(df_etf) == 0:
            return {}

        # call/put 区分
        cp_col = next((c for c in ("call_put", "cp", "contract_type") if c in df_etf.columns), None)
        if cp_col is None:
            return {}
        calls = df_etf[df_etf[cp_col].astype(str).str.upper().str.startswith("C")]
        puts = df_etf[df_etf[cp_col].astype(str).str.upper().str.startswith("P")]
        call_vol = float(calls["vol"].sum()) if "vol" in calls.columns and len(calls) else 0
        put_vol = float(puts["vol"].sum()) if "vol" in puts.columns and len(puts) else 0
        pcr = (put_vol / call_vol) if call_vol > 0 else 1.0

        # 隐含波动率（IV）：取平值附近合约，这里简化为 call+put 均值
        iv_col = next((c for c in ("imp_vol", "iv", "implied_vol") if c in df_etf.columns), None)
        iv = float(df_etf[iv_col].mean()) if iv_col else None

        # 对应指数点位（用于反推标的涨跌）
        idx_code = OPTION_ETFS_INDEX.get(etf_code)
        idx_chg = None
        if idx_code:
            try:
                idx_df = self.fetcher.fetch_index_daily(idx_code, days=3, end=trade_date)
                if len(idx_df) >= 2:
                    idx_chg = (idx_df.iloc[-1]["close"] - idx_df.iloc[-2]["close"]) / idx_df.iloc[-2]["close"] * 100
            except Exception:
                pass

        return {
            "etf_code": etf_code,
            "etf_name": etf_name,
            "index_name": INDEX_NAMES.get(idx_code, "") if idx_code else "",
            "index_chg": idx_chg,
            "call_vol": call_vol,
            "put_vol": put_vol,
            "pcr": pcr,
            "iv": iv,
            "signal": "认购活跃偏多" if pcr < 0.7 else ("认沽活跃偏空" if pcr > 1.3 else "情绪中性"),
        }

    def to_markdown(self, result: Dict[str, Any]) -> str:
        lines = [f"### 5. {self.name}", ""]
        lines.append(f"**综合评分：** {result['score']}/100  | **偏向：** {result['bias']}")
        lines.append(f"**结论：** {result['summary']}")
        lines.append("")
        etfs = result["detail"].get("etfs", {})
        rows = []
        for code, e in etfs.items():
            if not e:
                continue
            rows.append({
                "标的": e["etf_name"],
                "对应指数": e.get("index_name", ""),
                "指数涨跌": pct_str(e.get("index_chg") or 0),
                "认购量": f"{e.get('call_vol',0):.0f}",
                "认沽量": f"{e.get('put_vol',0):.0f}",
                "PCR": f"{e.get('pcr',1):.2f}",
                "IV": f"{e.get('iv',0):.2f}" if e.get("iv") else "-",
                "信号": e.get("signal", ""),
            })
        if rows:
            lines.append("\n" + md_table(pd.DataFrame(rows)))
        if result["signals"]:
            lines.append("\n**信号：**")
            for s in result["signals"]:
                lines.append(f"- {s}")
        return "\n".join(lines)
