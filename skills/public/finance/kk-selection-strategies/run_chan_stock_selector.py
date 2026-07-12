#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
缠论MACD背驰选股脚本（自包含版）

内嵌 chan_theory_v2 引擎，基于缠论 MACD 红绿柱面积对比算法，全市场批量扫描背驰信号。
数据通过 Tushare Pro API 实时获取，不依赖本地数据库。

算法核心：
  底背驰 = 绿柱面积扩张 + 价格创新低 + MACD金叉确认 → 买入信号
  顶背驰 = 红柱面积萎缩 + 价格创新高 + MACD死叉确认 → 卖出信号

用法:
    python scripts/selection-strategies/run_chan_stock_selector.py --json
    python scripts/selection-strategies/run_chan_stock_selector.py --pool hs300 --json
    python scripts/selection-strategies/run_chan_stock_selector.py --freq 30min --signal buy --json
    python scripts/selection-strategies/run_chan_stock_selector.py --pool zz500 --top 30 --json
"""

import sys
import os
import subprocess
import json
import argparse

# ── 路径解析 ──────────────────────────────────────────────
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_SKILL_ROOT = os.path.dirname(os.path.dirname(_SCRIPT_DIR))

# 内嵌缠论引擎路径
_CHAN_ENGINE_SCRIPT = os.path.join(_SKILL_ROOT, "scripts", "run_chan_stock_selector.py")

# 兼容：如果在主项目内运行，也尝试主项目脚本
_PROJECT_ROOT = os.path.dirname(_SKILL_ROOT)
_MAIN_PROJECT_SCRIPT = os.path.join(_PROJECT_ROOT, "scripts", "run_chan_stock_selector.py")


def _resolve_script():
    """解析可用的缠论选股脚本"""
    # 优先使用内嵌引擎
    if os.path.exists(_CHAN_ENGINE_SCRIPT):
        return _CHAN_ENGINE_SCRIPT, _SKILL_ROOT
    # 回退到主项目脚本
    if os.path.exists(_MAIN_PROJECT_SCRIPT):
        return _MAIN_PROJECT_SCRIPT, _PROJECT_ROOT
    return None, None


def main():
    parser = argparse.ArgumentParser(description="缠论MACD背驰选股")
    parser.add_argument("--pool", default=None, help="股票池: hs300/zz500/zz1000/all（默认全市场）")
    parser.add_argument("--freq", default=None, help="时间周期: 30min/daily（默认daily）")
    parser.add_argument("--top", type=int, default=None, help="返回数量（默认50）")
    parser.add_argument("--signal", default=None, help="信号类型: buy/sell/all（默认all）")
    parser.add_argument("--json", action="store_true", help="JSON输出")
    args = parser.parse_args()

    script, cwd = _resolve_script()

    if not script:
        print(json.dumps({
            "error": "缠论选股引擎不可用",
            "hint": "请确保 scripts/chan_engine/ 目录存在且包含缠论引擎代码"
        }, ensure_ascii=False))
        sys.exit(1)

    cmd = [sys.executable, script, "--json"]
    if args.pool:
        cmd.extend(["--pool", args.pool])
    if args.freq:
        cmd.extend(["--freq", args.freq])
    if args.top:
        cmd.extend(["--top", str(args.top)])
    if args.signal:
        cmd.extend(["--signal", args.signal])

    result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, timeout=600)

    if result.stdout:
        print(result.stdout)
    else:
        print(json.dumps({"error": result.stderr or "缠论选股无输出"}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
