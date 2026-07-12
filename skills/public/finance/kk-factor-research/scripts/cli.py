#!/usr/bin/env python3
"""
kk-factor-research CLI — 量化因子研究统一入口

支持三种模式:
  analyze  — IC/IR 分析 + 分层回测
  filter   — 基本面因子筛选（PE/PB/ROE）
  help     — 显示帮助

用法:
  python cli.py analyze --factor-csv <path> --return-csv <path> --output-dir <path> [--n-groups 5]
  python cli.py filter  --codes 000001.SZ,600036.SH --pe-max 20 --pb-max 3 --roe-min 8
  python cli.py help
"""
import argparse
import json
import os
import sys

# 添加 analysis 目录到 path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ANALYSIS_DIR = os.path.join(SCRIPT_DIR, "analysis")
sys.path.insert(0, ANALYSIS_DIR)


def cmd_analyze(args):
    """IC/IR 分析 + 分层回测"""
    import pandas as pd
    from factor_engine import load_csv, compute_ic_series, ic_summary, quantile_backtest, save_results

    if not os.path.isfile(args.factor_csv):
        print(json.dumps({"error": f"因子文件不存在: {args.factor_csv}"}))
        sys.exit(1)
    if not os.path.isfile(args.return_csv):
        print(json.dumps({"error": f"收益文件不存在: {args.return_csv}"}))
        sys.exit(1)

    factor_df = load_csv(args.factor_csv)
    return_df = load_csv(args.return_csv)

    ic_df = compute_ic_series(factor_df, return_df)
    ic_sum = ic_summary(ic_df)
    bt_result = quantile_backtest(factor_df, return_df, n_groups=args.n_groups)

    if args.output_dir:
        save_info = save_results(args.output_dir, ic_df, ic_sum, bt_result)
        output = {"ic_summary": ic_sum, "backtest": bt_result, "saved": save_info}
    else:
        output = {"ic_summary": ic_sum, "backtest": bt_result}

    print(json.dumps(output, ensure_ascii=False, indent=2, default=str))


def cmd_filter(args):
    """基本面因子筛选"""
    from fundamental_filter import SignalEngine

    codes = [c.strip() for c in args.codes.split(",") if c.strip()]
    if not codes:
        print(json.dumps({"error": "请提供股票代码 (--codes)"}))
        sys.exit(1)

    engine = SignalEngine(
        pe_max=args.pe_max,
        pb_max=args.pb_max,
        roe_min=args.roe_min,
    )

    # 输出筛选参数
    result = {
        "action": "fundamental_filter",
        "params": {
            "codes": codes,
            "pe_max": args.pe_max,
            "pb_max": args.pb_max,
            "roe_min": args.roe_min,
        },
        "criteria": {
            "value": f"0 < PE <= {args.pe_max} AND PB <= {args.pb_max} AND ROE >= {args.roe_min}%",
            "signal": "满足条件的股票等权做多 (1/N)",
        },
        "note": "SignalEngine 需配合 tushare daily_basic 数据的 DataFrame 使用，"
                "此处仅输出筛选参数。详见 scripts/analysis/fundamental_filter.py",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


def show_help():
    help_text = """
kk-factor-research — 量化因子研究技能包
======================================

模式1: analyze — 因子有效性分析
--------------------------------
  python cli.py analyze \\
    --factor-csv factor.csv \\
    --return-csv return.csv \\
    --output-dir ./output \\
    --n-groups 5

  输入文件格式: CSV (index=date, columns=股票代码)
  输出: IC/IR 统计 + 分层回测结果

模式2: filter — 基本面因子筛选
-------------------------------
  python cli.py filter \\
    --codes 000001.SZ,600036.SH,000858.SZ \\
    --pe-max 20 --pb-max 3 --roe-min 8

  筛选条件: 0 < PE <= pe_max AND PB <= pb_max AND ROE >= roe_min%

模式3: 多因子组合（Python 调用）
---------------------------------
  import sys; sys.path.insert(0, 'scripts/analysis')
  from factor_engine import factor_combination
  composite = factor_combination([df1, df2, df3], method='equal_weight')

组合方法: equal_weight / ic_weight / orthogonal

因子方法论参考: references/factor-methodology.md
"""
    print(help_text)


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("help", "-h", "--help"):
        show_help()
        sys.exit(0)

    parser = argparse.ArgumentParser(
        description="kk-factor-research — 量化因子研究技能包",
    )
    sub = parser.add_subparsers(dest="mode")

    # analyze 模式
    p_analyze = sub.add_parser("analyze", help="IC/IR 分析 + 分层回测")
    p_analyze.add_argument("--factor-csv", required=True, help="因子值 CSV 路径")
    p_analyze.add_argument("--return-csv", required=True, help="收益 CSV 路径")
    p_analyze.add_argument("--output-dir", default=None, help="输出目录")
    p_analyze.add_argument("--n-groups", type=int, default=5, help="分组数 (默认5)")

    # filter 模式
    p_filter = sub.add_parser("filter", help="基本面因子筛选")
    p_filter.add_argument("--codes", required=True, help="股票代码（逗号分隔）")
    p_filter.add_argument("--pe-max", type=float, default=20.0, help="PE 上限")
    p_filter.add_argument("--pb-max", type=float, default=3.0, help="PB 上限")
    p_filter.add_argument("--roe-min", type=float, default=8.0, help="ROE 下限 (%)")

    args = parser.parse_args()

    if args.mode == "analyze":
        cmd_analyze(args)
    elif args.mode == "filter":
        cmd_filter(args)
    else:
        show_help()


if __name__ == "__main__":
    main()
