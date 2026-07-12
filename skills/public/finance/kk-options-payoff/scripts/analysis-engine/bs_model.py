"""
Black-Scholes 期权定价模型

提供：
- 欧式 Call/Put 定价
- 五大 Greeks 计算（Delta/Gamma/Theta/Vega/Rho）
- 隐含波动率反解（Newton-Raphson + 二分法兜底）
- Put-Call Parity 验证
"""

import numpy as np
from scipy.stats import norm
from scipy.optimize import brentq
from typing import Literal


def bs_price(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    option_type: Literal["call", "put"],
    q: float = 0.0,
) -> float:
    """Black-Scholes 期权定价。

    Args:
        S: 标的现价
        K: 行权价
        T: 到期时间（年）
        r: 无风险利率（年化连续复利，如 0.03）
        sigma: 年化波动率（如 0.20）
        option_type: "call" 或 "put"
        q: 连续股息率，默认 0

    Returns:
        理论期权价格
    """
    if T <= 0:
        if option_type == "call":
            return max(0.0, S - K)
        return max(0.0, K - S)
    if sigma <= 0:
        raise ValueError(f"sigma must be > 0, got {sigma}")

    d1 = (np.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)

    if option_type == "call":
        price = S * np.exp(-q * T) * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
    else:
        price = K * np.exp(-r * T) * norm.cdf(-d2) - S * np.exp(-q * T) * norm.cdf(-d1)

    return float(price)


def bs_greeks(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    option_type: Literal["call", "put"],
    q: float = 0.0,
) -> dict:
    """计算 Black-Scholes 五大 Greeks。

    Returns:
        包含 delta, gamma, theta, vega, rho 的字典。
        Theta 和 Vega 已转换为每天/每 1% 单位。
    """
    if T <= 1e-6:
        return {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "rho": 0.0}

    d1 = (np.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    n_prime_d1 = norm.pdf(d1)
    exp_qt = np.exp(-q * T)
    exp_rt = np.exp(-r * T)

    gamma = exp_qt * n_prime_d1 / (S * sigma * np.sqrt(T))
    vega = S * exp_qt * n_prime_d1 * np.sqrt(T) / 100

    if option_type == "call":
        delta = exp_qt * norm.cdf(d1)
        rho = K * T * exp_rt * norm.cdf(d2) / 100
        theta = (
            -S * exp_qt * n_prime_d1 * sigma / (2 * np.sqrt(T))
            - r * K * exp_rt * norm.cdf(d2)
            + q * S * exp_qt * norm.cdf(d1)
        ) / 365
    else:
        delta = exp_qt * (norm.cdf(d1) - 1)
        rho = -K * T * exp_rt * norm.cdf(-d2) / 100
        theta = (
            -S * exp_qt * n_prime_d1 * sigma / (2 * np.sqrt(T))
            + r * K * exp_rt * norm.cdf(-d2)
            - q * S * exp_qt * norm.cdf(-d1)
        ) / 365

    return {
        "delta": round(delta, 6),
        "gamma": round(gamma, 6),
        "theta": round(theta, 6),
        "vega": round(vega, 6),
        "rho": round(rho, 6),
    }


def implied_volatility(
    market_price: float,
    S: float,
    K: float,
    T: float,
    r: float,
    option_type: Literal["call", "put"],
    q: float = 0.0,
    tol: float = 1e-6,
    max_iter: int = 200,
) -> float:
    """Newton-Raphson 隐含波动率反解。

    Args:
        market_price: 市场价格
        tol: 收敛精度
        max_iter: 最大迭代次数

    Returns:
        年化隐含波动率。失败返回 np.nan。
    """
    intrinsic = max(0.0, S - K if option_type == "call" else K - S)
    if market_price < intrinsic - 1e-6:
        raise ValueError(
            f"Market price {market_price} < intrinsic value {intrinsic}"
        )

    # Brenner-Subrahmanyam 初始估计
    sigma = np.sqrt(2 * np.pi / T) * market_price / S
    sigma = max(0.001, min(sigma, 5.0))

    for _ in range(max_iter):
        price = bs_price(S, K, T, r, sigma, option_type, q)
        vega = bs_greeks(S, K, T, r, sigma, option_type, q)["vega"] * 100

        diff = price - market_price
        if abs(diff) < tol:
            return round(sigma, 6)

        if abs(vega) < 1e-10:
            try:
                return float(brentq(
                    lambda v: bs_price(S, K, T, r, v, option_type, q) - market_price,
                    1e-4, 10.0, xtol=tol, maxiter=200,
                ))
            except ValueError:
                return np.nan

        sigma -= diff / vega
        sigma = max(1e-4, min(sigma, 10.0))

    return np.nan


def put_call_parity_check(
    call_price: float,
    put_price: float,
    S: float,
    K: float,
    T: float,
    r: float,
    q: float = 0.0,
) -> dict:
    """验证 Put-Call Parity。

    Returns:
        包含 parity_value, actual_diff, is_valid 的字典。
    """
    expected = S * np.exp(-q * T) - K * np.exp(-r * T)
    actual = call_price - put_price
    diff = abs(actual - expected)

    return {
        "parity_theoretical": round(expected, 6),
        "parity_actual": round(actual, 6),
        "deviation": round(diff, 6),
        "is_valid": diff < 0.01 * S,  # 容差为标的价的 1%
    }
