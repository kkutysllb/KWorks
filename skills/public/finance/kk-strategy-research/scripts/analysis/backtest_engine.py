"""

功能:
  - 从 SignalEngine 输出的信号评估回测表现
  - 支持单标的和组合策略
  - 计算核心指标: 总收益/年化/夏普/最大回撤/胜率/交易次数
  - 持仓记录: 每日持仓快照（标的/方向/数量/成本/市值/浮盈）
  - 调仓记录: 信号变化时的买卖明细（调仓前后持仓对比）
"""

import json
import os
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd


def run_backtest(
    data_map: Dict[str, pd.DataFrame],
    signals: Dict[str, pd.Series],
    initial_cash: float = 1_000_000,
    commission: float = 0.001,
    record_positions: bool = True,
) -> Dict:
    """
    简化回测引擎：根据信号计算策略表现。

    Args:
        data_map: code -> DataFrame (columns: open, high, low, close, volume)
        signals: code -> signal Series (value in [-1.0, 1.0])
        initial_cash: 初始资金
        commission: 单边手续费率
        record_positions: 是否记录每日持仓快照

    Returns:
        dict with metrics, equity curve, trade log, position snapshots, rebalance records
    """
    codes = [c for c in signals if c in data_map]
    if not codes:
        return {"error": "无有效标的"}

    # 合并日期索引
    all_dates = sorted(set().union(*(data_map[c].index for c in codes)))
    if not all_dates:
        return {"error": "无交易日期"}

    equity = [initial_cash]
    equity_dates = [all_dates[0]]
    trades = []
    rebalance_records = []  # 调仓记录
    position_snapshots = []  # 每日持仓快照
    positions = {c: 0.0 for c in codes}
    cost_basis = {c: 0.0 for c in codes}  # 持仓成本价
    prev_signals = {c: 0.0 for c in codes}
    total_commission = 0.0

    for i, dt in enumerate(all_dates[1:], 1):
        daily_pnl = 0.0
        daily_rebalance_actions = []  # 当日调仓动作

        for code in codes:
            if dt not in data_map[code].index:
                continue
            row = data_map[code].loc[dt]
            close = row.get("close", np.nan)
            if pd.isna(close):
                continue

            sig = 0.0
            if code in signals and dt in signals[code].index:
                sig = float(signals[code].loc[dt])

            # 限制信号范围
            sig = max(-1.0, min(1.0, sig))

            # 检测信号变化 → 交易
            prev_sig = prev_signals.get(code, 0.0)
            if sig != prev_sig and i > 0:
                rebalance = {
                    "date": str(dt.date()),
                    "code": code,
                    "signal_before": round(prev_sig, 4),
                    "signal_after": round(sig, 4),
                }

                # 平旧仓位
                if positions[code] != 0:
                    old_qty = positions[code]
                    old_cost = cost_basis[code]
                    close_pnl = old_qty * (close - old_cost)
                    cost = abs(old_qty * close * commission)
                    daily_pnl += close_pnl - cost
                    total_commission += cost
                    trades.append({
                        "date": str(dt.date()),
                        "code": code,
                        "action": "close" if old_qty > 0 else "cover",
                        "price": round(close, 4),
                        "quantity": round(abs(old_qty), 4),
                        "cost_price": round(old_cost, 4),
                        "realized_pnl": round(close_pnl - cost, 2),
                    })
                    rebalance["action_close"] = {
                        "direction": "long" if old_qty > 0 else "short",
                        "quantity": round(abs(old_qty), 4),
                        "price": round(close, 4),
                        "realized_pnl": round(close_pnl - cost, 2),
                    }

                # 开新仓位
                if sig != 0:
                    alloc = equity[-1] * abs(sig) / len(codes)
                    qty = alloc / close * sig
                    cost = abs(alloc * commission)
                    daily_pnl -= cost
                    total_commission += cost
                    positions[code] = qty
                    cost_basis[code] = close
                    trades.append({
                        "date": str(dt.date()),
                        "code": code,
                        "action": "buy" if sig > 0 else "sell",
                        "price": round(close, 4),
                        "quantity": round(abs(qty), 4),
                        "cost_price": round(close, 4),
                        "realized_pnl": 0.0,
                    })
                    rebalance["action_open"] = {
                        "direction": "long" if sig > 0 else "short",
                        "quantity": round(abs(qty), 4),
                        "price": round(close, 4),
                        "signal_strength": round(abs(sig), 4),
                    }
                else:
                    positions[code] = 0.0
                    cost_basis[code] = 0.0
                prev_signals[code] = sig
                rebalance_records.append(rebalance)

            # 持仓盈亏
            if positions[code] != 0 and (i > 0):
                prev_dt = all_dates[i - 1]
                if prev_dt in data_map[code].index:
                    prev_close = data_map[code].loc[prev_dt].get("close", close)
                    daily_pnl += positions[code] * (close - prev_close)

        equity.append(equity[-1] + daily_pnl)
        equity_dates.append(dt)

        # 记录每日持仓快照
        if record_positions:
            snapshot = {"date": str(dt.date())}
            holding_total = 0.0
            for code in codes:
                if dt not in data_map[code].index:
                    continue
                price = data_map[code].loc[dt].get("close", 0)
                qty = positions[code]
                if qty == 0:
                    continue
                mv = qty * price
                holding_total += mv
                unrealized = qty * (price - cost_basis[code])
                snapshot[code] = {
                    "direction": "long" if qty > 0 else "short",
                    "quantity": round(abs(qty), 4),
                    "cost_price": round(cost_basis[code], 4),
                    "market_price": round(price, 4),
                    "market_value": round(mv, 2),
                    "unrealized_pnl": round(unrealized, 2),
                    "unrealized_pnl_pct": round(unrealized / (abs(qty) * cost_basis[code]) * 100, 2) if cost_basis[code] > 0 else 0,
                }
            cash = equity[-1] - holding_total
            snapshot["_summary"] = {
                "equity": round(equity[-1], 2),
                "cash": round(cash, 2),
                "holding_value": round(holding_total, 2),
                "position_utilization": round(holding_total / equity[-1] * 100, 2) if equity[-1] > 0 else 0,
                "holding_count": sum(1 for c in codes if positions[c] != 0),
            }
            position_snapshots.append(snapshot)

    # 计算指标
    equity_series = pd.Series(equity, index=equity_dates)
    metrics = _compute_metrics(equity_series, initial_cash, len(trades))
    metrics["total_commission"] = round(total_commission, 2)

    return {
        "metrics": metrics,
        "equity_dates": [str(d.date()) if hasattr(d, "date") else str(d) for d in equity_dates],
        "equity_values": [round(v, 2) for v in equity],
        "trade_count": len(trades),
        "trades": trades,
        "rebalance_records": rebalance_records,
        "rebalance_count": len(rebalance_records),
        "position_snapshots": position_snapshots,
    }


def _compute_metrics(equity: pd.Series, initial_cash: float, trade_count: int) -> Dict:
    """计算回测指标"""
    total_return = (equity.iloc[-1] / initial_cash - 1) * 100

    # 日收益率
    returns = equity.pct_change().dropna()
    if len(returns) == 0:
        return {"total_return_pct": 0, "annual_return_pct": 0, "sharpe": 0,
                "max_drawdown_pct": 0, "win_rate": 0, "trade_count": trade_count}

    # 年化
    n_days = len(returns)
    annual_factor = 252
    annual_return = (1 + total_return / 100) ** (annual_factor / max(n_days, 1)) - 1

    # 夏普
    sharpe = returns.mean() / returns.std() * np.sqrt(annual_factor) if returns.std() > 0 else 0

    # 最大回撤
    peak = equity.expanding().max()
    drawdown = (equity - peak) / peak
    max_dd = drawdown.min() * 100

    # 胜率（按日）
    win_days = (returns > 0).sum()
    win_rate = win_days / len(returns) * 100

    return {
        "total_return_pct": round(total_return, 2),
        "annual_return_pct": round(annual_return * 100, 2),
        "sharpe_ratio": round(sharpe, 4),
        "max_drawdown_pct": round(max_dd, 2),
        "win_rate_pct": round(win_rate, 2),
        "trade_count": trade_count,
        "n_days": n_days,
    }


def evaluate_strategy(metrics: Dict) -> Dict:
    """根据评审标准评估策略"""
    score = 60  # 基础分
    issues = []
    action_items = []

    if metrics.get("trade_count", 0) == 0:
        score -= 30
        issues.append("零交易：信号逻辑可能有 bug，条件可能太严格")
        action_items.append("放宽信号条件，降低阈值或缩短计算窗口")

    if metrics.get("total_return_pct", 0) < -20:
        score -= 10
        issues.append(f"严重亏损: {metrics['total_return_pct']}%")

    if metrics.get("max_drawdown_pct", 0) < -30:
        score -= 5
        issues.append(f"最大回撤较大: {metrics['max_drawdown_pct']}%")
        action_items.append("添加止损逻辑：当亏损超过 5% 时强制平仓")

    if metrics.get("sharpe_ratio", 0) < 0.5:
        issues.append(f"夏普比率偏低: {metrics['sharpe_ratio']}")
        action_items.append("添加趋势过滤：仅在均线多头排列时做多")

    passed = score >= 60
    return {
        "passed": passed,
        "score": score,
        "issues": issues,
        "action_items": action_items,
    }
