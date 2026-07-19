#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
个股趋势预测分析脚本（技能包桥接版）

桥接到项目主 scripts/run_trend_prediction.py。
使用机器学习集成模型（LightGBM/XGBoost/CatBoost）预测个股趋势。

核心功能：
  - 多模型集成预测（LightGBM/XGBoost/CatBoost）
  - 多源特征工程（量价/技术/基本面/宏观因子）
  - 趋势方向预测 + 置信度评分
  - 历史回测表现统计

用法:
    python scripts/analysis-engine/analyze_trend_prediction.py --stock 600519.SH --json
    python scripts/analysis-engine/analyze_trend_prediction.py --stock 宁德时代 --date 20260301 --json
"""

import sys
import os
import subprocess
import json
import argparse

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_SKILL_ROOT = os.path.dirname(os.path.dirname(_SCRIPT_DIR))
_PROJECT_ROOT = os.path.dirname(_SKILL_ROOT)
_MAIN_SCRIPT = os.path.join(_SKILL_ROOT, "scripts", "run_trend_prediction.py")


def main():
    parser = argparse.ArgumentParser(description="个股趋势预测（ML集成模型）")
    parser.add_argument("--stock", required=True, help="股票代码或名称")
    parser.add_argument("--date", default=None, help="预测日期 YYYYMMDD（默认最新交易日）")
    parser.add_argument("--no-ensemble", action="store_true", help="不使用集成模型")
    parser.add_argument("--json", action="store_true", help="JSON输出")
    args = parser.parse_args()

    if not os.path.exists(_MAIN_SCRIPT):
        print(json.dumps({
            "error": f"趋势预测主脚本不存在: {_MAIN_SCRIPT}",
            "hint": "请确保 kk-stock-analysis/scripts/ 目录下存在 run_trend_prediction.py"
        }, ensure_ascii=False))
        sys.exit(1)

    cmd = [sys.executable, _MAIN_SCRIPT, "--stock", args.stock, "--json"]
    if args.date:
        cmd.extend(["--date", args.date])
    if args.no_ensemble:
        cmd.append("--no-ensemble")

    result = subprocess.run(cmd, capture_output=True, text=True, cwd=_PROJECT_ROOT, timeout=300)

    if result.stdout:
        print(result.stdout)
    else:
        print(json.dumps({"error": result.stderr or "趋势预测无输出"}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
