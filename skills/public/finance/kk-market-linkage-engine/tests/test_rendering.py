from __future__ import annotations

from pathlib import Path
import sys

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from market_linkage_engine.analyzers.futures_basis import FuturesBasisAnalyzer
from market_linkage_engine.analyzers.main_capital import MainCapitalAnalyzer
from market_linkage_engine.analyzers.margin import MarginAnalyzer
from market_linkage_engine.analyzers.dragon_tiger import DragonTigerAnalyzer
from market_linkage_engine.analyzers.northbound import NorthboundAnalyzer
from market_linkage_engine.analyzers.shibor import ShiborAnalyzer
from market_linkage_engine.data.fetcher import LinkageFetcher
from market_linkage_engine.utils import md_table


def test_md_table_can_rename_headers_for_display() -> None:
    df = pd.DataFrame(
        [
            {"ts_code": "000001.SZ", "name": "平安银行", "net_mf_amount": 123456789},
        ]
    )

    table = md_table(
        df,
        rename={
            "ts_code": "证券代码",
            "name": "名称",
            "net_mf_amount": "净额",
        },
    )

    assert "证券代码" in table
    assert "名称" in table
    assert "净额" in table
    assert "ts_code" not in table
    assert "net_mf_amount" not in table


def test_fetch_main_capital_stocks_keeps_full_sorted_dataset() -> None:
    class FakeTS:
        def moneyflow(self, trade_date: str) -> pd.DataFrame:
            return pd.DataFrame(
                [
                    {"ts_code": "000001.SZ", "net_amount": 12.5},
                    {"ts_code": "000002.SZ", "net_amount": 8.2},
                    {"ts_code": "000003.SZ", "net_amount": -3.1},
                ]
            )

    fetcher = LinkageFetcher.__new__(LinkageFetcher)
    fetcher.ts = FakeTS()

    result = LinkageFetcher.fetch_main_capital_stocks(fetcher, "20260717", top_n=2)

    assert len(result) == 3
    assert list(result["ts_code"]) == ["000001.SZ", "000002.SZ", "000003.SZ"]


def test_main_capital_markdown_hides_raw_fields_and_filters_outflow_rows() -> None:
    class FakeFetcher:
        def fetch_main_capital_stocks(self, trade_date: str, top_n: int = 15) -> pd.DataFrame:
            return pd.DataFrame(
                [
                    {"ts_code": "000001.SZ", "name": "平安银行", "net_amount": 12.5},
                    {"ts_code": "000002.SZ", "name": "万科A", "net_amount": 8.2},
                    {"ts_code": "000003.SZ", "name": "国华网安", "net_amount": 4.1},
                ]
            )

        def fetch_main_capital_sector(self, trade_date: str) -> pd.DataFrame:
            return pd.DataFrame(
                [
                    {"name": "银行", "net_amount": 6.0},
                    {"name": "地产", "net_amount": 3.5},
                ]
            )

        def fetch_main_capital_industry_ths(self, trade_date: str) -> pd.DataFrame:
            return pd.DataFrame()

    analyzer = MainCapitalAnalyzer(FakeFetcher())
    result = analyzer.analyze("20260717")
    markdown = analyzer.to_markdown(result)

    assert "证券代码" in markdown
    assert "名称" in markdown
    assert "净额" in markdown
    assert "ts_code" not in markdown
    assert "net_amount" not in markdown
    assert "主力净流出个股 TOP" not in markdown


def test_futures_basis_treats_negative_basis_as_bearish() -> None:
    class FakeFetcher:
        def fetch_futures_daily(self, ts_code: str, days: int = 30, end: str | None = None) -> pd.DataFrame:
            return pd.DataFrame(
                [
                    {
                        "ts_code": "IF.CFX",
                        "trade_date": pd.Timestamp("2026-07-17"),
                        "vol": 1000,
                        "close": 4500.2,
                        "settle": 4500.2,
                    }
                ]
            )

        def fetch_index_daily(self, ts_code: str, days: int = 30, end: str | None = None) -> pd.DataFrame:
            return pd.DataFrame(
                [
                    {"close": 4529.1},
                ]
            )

        def fetch_futures_holding(self, symbol: str, trade_date: str | None = None, days: int = 7) -> pd.DataFrame:
            return pd.DataFrame()

    analyzer = FuturesBasisAnalyzer(FakeFetcher())
    result = analyzer.analyze("20260717")
    markdown = analyzer.to_markdown(result)

    assert result["bias"] == "bearish"
    assert any("贴水" in signal for signal in result["signals"])
    assert "升水偏多" not in markdown
    assert "贴水偏空" in markdown


def test_shibor_does_not_warn_when_curve_is_only_slightly_flat() -> None:
    class FakeFetcher:
        def fetch_shibor(self, days: int = 30, end: str | None = None) -> pd.DataFrame:
            dates = pd.date_range("2026-06-16", periods=31, freq="D")
            rows = []
            for date in dates:
                rows.append(
                    {
                        "date": date,
                        "ON": 1.3971,
                        "1W": 1.4350,
                        "1M": 1.4200,
                        "3M": 1.4300,
                        "6M": 1.4460,
                        "1Y": 1.4722,
                    }
                )
            return pd.DataFrame(rows)

        def fetch_shibor_lpr(self, days: int = 720, end: str | None = None) -> pd.DataFrame:
            return pd.DataFrame()

    analyzer = ShiborAnalyzer(FakeFetcher())
    result = analyzer.analyze("20260717")

    assert result["bias"] == "neutral"
    assert all("倒挂/极度平坦" not in signal for signal in result["signals"])
    assert result["detail"]["term_spread_1y_on"] > 0


def test_remaining_tables_use_user_friendly_headers() -> None:
    northbound = NorthboundAnalyzer(None)
    northbound_markdown = northbound.to_markdown(
        {
            "score": 60,
            "bias": "bullish",
            "summary": "ok",
            "signals": [],
            "detail": {
                "trade_date": "20260717",
                "latest_net": 123400000,
                "latest_sh": 100000000,
                "latest_sz": 23400000,
                "cum_net": 567800000,
                "total_days": 5,
                "net_positive_days": 4,
                "streak": 3,
                "streak_sign": "净流入",
                "top10": [
                    {
                        "ts_code": "600000.SH",
                        "name": "浦发银行",
                        "close": 10.2,
                        "amount": 123000000,
                        "net_amount": 45600000,
                    }
                ],
            },
        }
    )
    assert "证券代码" in northbound_markdown
    assert "ts_code" not in northbound_markdown

    margin = MarginAnalyzer(None)
    margin_markdown = margin.to_markdown(
        {
            "score": 50,
            "bias": "neutral",
            "summary": "ok",
            "signals": [],
            "detail": {
                "trade_date": "20260717",
                "rzye": 100000000,
                "rqye": 10000000,
                "total": 110000000,
                "rz_net": 1000000,
                "trend": "上升",
                "ma5": 90000000,
                "top_stocks": [
                    {
                        "trade_date": pd.Timestamp("2026-07-17"),
                        "ts_code": "600000.SH",
                        "name": "浦发银行",
                        "rzye": 100000000,
                        "rqye": 10000000,
                        "rzmre": 5000000,
                        "rzche": 4000000,
                        "rzrqye": 110000000,
                    }
                ],
            },
        }
    )
    assert "证券代码" in margin_markdown
    assert "rzye" not in margin_markdown

    dragon = DragonTigerAnalyzer(None)
    dragon_markdown = dragon.to_markdown(
        {
            "score": 70,
            "bias": "bullish",
            "summary": "ok",
            "signals": [],
            "detail": {
                "trade_date": "20260717",
                "list_count": 1,
                "stocks": [
                    {
                        "ts_code": "000566.SZ",
                        "name": "海南海药",
                        "reason": "日振幅值达到15%的前5只证券",
                    }
                ],
                "inst_net_top": [
                    {"ts_code": "000566.SZ", "inst_net": 12300000},
                ],
            },
        }
    )
    assert "证券代码" in dragon_markdown
    assert "inst_net" not in dragon_markdown
