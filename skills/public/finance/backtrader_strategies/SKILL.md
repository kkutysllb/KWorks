---
name: backtrader_strategies
description: 量化选股策略适配器库——封装价值投资、成长股、动量突破、高股息、技术突破、超跌反弹、连板龙头、融资追踪 8 大策略的选股逻辑，从 API 层分离核心算法。被 kk-selection-strategies 等技能引用。当需要实现批量量化选股、多策略组合筛选、策略回测适配时使用此技能。
version: 1.0.0
author: kk-quant
license: MIT
category: finance


package:
  type: python
  entry: strategy_adapters/__init__.py
capabilities:
  - id: value-investment
    description: "价值投资策略：低估值 + 高 ROE + 稳定现金流的复合筛选"
  - id: growth-stock
    description: "成长股策略：EPS / 营收增速双驱动，PEG 0.2~1.5 分级筛选"
  - id: momentum-breakthrough
    description: "动量突破策略：识别价格突破关键阻力位后的趋势延续机会"
  - id: high-dividend
    description: "高股息策略：股息率 + 分红稳定性 + 盈利质量三维筛选"
  - id: technical-breakthrough
    description: "技术突破策略：基于 MACD / 均线 / 量价配合的技术信号"
  - id: oversold-rebound
    description: "超跌反弹策略：识别短期超跌后的技术性反弹机会"
  - id: limit-up-leader
    description: "连板龙头策略：追踪涨停板龙头股的连板节奏与板块效应"
  - id: fund-flow-tracking
    description: "融资追踪策略：主力资金流向 + 融资融券数据的资金面分析"

permissions:
  network: true
  filesystem: false
  shell: false
  env:
    - TUSHARE_TOKEN

requires:
  bins: ["python3"]
  packages: ["pandas", "tushare"]
  env: ["TUSHARE_TOKEN"]

metadata:
  openclaw:
    emoji: "📈"
    version: "1.0.0"
    author: "kk-quant"
    category: "library"
    tags:
      - library
      - backtrader
      - selection-strategies
      - tushare
    requires:
      bins: ["python3"]
      packages: ["pandas", "tushare"]
      env: ["TUSHARE_TOKEN"]

tags:
  - library
  - backtrader
  - selection-strategies
  - tushare
---

# backtrader-strategies

量化选股策略适配器库，封装 8 大核心策略的选股逻辑。

## 用途

本库被 `kk-selection-strategies` 技能引用，提供策略适配器层 —— 把策略核心算法与 API 接口层分离，便于策略集中管理与复用。

## 8 大策略适配器

| 适配器 | 策略类型 | 说明 |
|--------|---------|------|
| `value_investment_adapter` | 价值投资 | 低估值 + 高 ROE + 稳定现金流 |
| `growth_stock_adapter` | 成长股 | EPS / 营收增速，PEG 分级筛选 |
| `momentum_breakthrough_adapter` | 动量突破 | 关键阻力位突破信号 |
| `high_dividend_adapter` | 高股息 | 股息率 + 分红稳定性 |
| `technical_breakthrough_adapter` | 技术突破 | MACD / 均线 / 量价技术信号 |
| `oversold_rebound_adapter_simple` | 超跌反弹 | 短期超跌技术性反弹 |
| `limit_up_leader_adapter_simple` | 连板龙头 | 涨停板龙头追踪 |
| `fund_flow_tracking_adapter` | 融资追踪 | 主力资金 + 融资融券分析 |

## 引用方式

```python
import sys, os
# 把 stock/ 目录加入 sys.path（与 kk-selection-strategies 一致）
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backtrader_strategies.strategy_adapters import (
    ValueInvestmentAdapter,
    GrowthStockAdapter,
    # ... 其他适配器
)
```

## 依赖

- Python 3.8+
- `pandas`、`tushare`
- 环境变量：`TUSHARE_TOKEN`
