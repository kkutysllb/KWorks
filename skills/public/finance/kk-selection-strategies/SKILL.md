---
name: kk-selection-strategies
description: A股多策略选股运行框架，提供10种经典选股策略的CLI运行脚本，涵盖成长股、价值投资、高股息、动量突破、技术突破、超跌反弹、涨停龙头、主力资金追踪、缠论背驰选股与多因子横截面。每种策略独立运行、可配置参数，支持市值/股票池过滤与结果导出。
version: 1.0.0
author: kk-quant
license: MIT
category: finance


package:
  type: knowledge-only
capabilities:
  - id: growth-stock-selection
    description: "成长股策略：EPS/营收增速双驱动，PEG 0.2~1.5，分级筛选成长性40%+盈利能力35%+创新投入15%+财务安全10%"
  - id: value-investment
    description: "价值投资策略：低PE+低PB+高ROE+高股息率，分级筛选估值30%+质量30%+股息25%+安全15%"
  - id: high-dividend
    description: "高股息策略：股息率≥4%+连续分红+低波动，分级筛选股息35%+稳定性30%+质量20%+估值15%"
  - id: momentum-breakthrough
    description: "动量突破策略：20/60日动量+量比放大+均线排列多头，分级筛选动量35%+趋势30%+资金20%+量能15%"
  - id: technical-breakthrough
    description: "技术突破策略：突破年线/箱体+缩量回踩确认+MACD金叉，分级筛选趋势35%+突破30%+量能20%+动能15%"
  - id: oversold-rebound
    description: "超跌反弹策略：RSI<30+乖离率<-15%+底部放量，分级筛选超跌40%+反转30%+资金20%+量能10%"
  - id: limit-up-leader
    description: "涨停龙头策略：涨停+板块共振+龙头特征，分级筛选强度40%+辨识度30%+板块效应20%+量价10%"
  - id: fund-flow-tracking
    description: "主力资金追踪策略：北向/主力净流入+机构调研，分级筛选资金40%+机构25%+趋势20%+估值15%"
  - id: chan-theory-selection
    description: "缠论背驰选股：底背驰/顶背驰+MACD背驰信号+三类买卖点，分级筛选背驰40%+中枢30%+量价20%+动能10%"
  - id: multi-factor-selection
    description: "多因子横截面选股：动量/反转/波动率/SIZE/估值/成长/质量七大因子Z-score标准化+等权/自定义加权+TopN组合构建"

permissions:
  network: false
  filesystem: true
  shell: true

metadata:
  openclaw:
    emoji: "🎯"
    version: "1.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - stock-selection
      - A-share
      - strategy
      - quantitative

tags:
  - finance
  - stock-selection
  - A-share
  - strategy
  - quantitative
---

# kk-selection-strategies

A 股多策略选股运行框架，提供 10 种经典选股策略的独立 CLI 脚本。

## 策略一览

| 策略 | 脚本 | 核心逻辑 | 适合场景 |
|------|------|---------|---------|
| 成长股 | `run_growth_stock.py` | EPS/营收增速双驱动，PEG 0.2~1.5 | 中长线成长投资 |
| 价值投资 | `run_value_investment.py` | 低PE+低PB+高ROE+高股息率 | 价值发现 |
| 高股息 | `run_high_dividend.py` | 股息率≥4%+连续分红+低波动 | 稳健收益 |
| 动量突破 | `run_momentum_breakthrough.py` | 动量+量比+均线多头排列 | 趋势跟踪 |
| 技术突破 | `run_technical_breakthrough.py` | 突破年线/箱体+MACD金叉 | 技术面交易 |
| 超跌反弹 | `run_oversold_rebound.py` | RSI<30+乖离率+底部放量 | 抄底反弹 |
| 涨停龙头 | `run_limit_up_leader.py` | 涨停+板块共振+龙头特征 | 短线打板 |
| 资金追踪 | `run_fund_flow_tracking.py` | 北向/主力净流入+机构调研 | 跟随主力 |
| 缠论背驰 | `run_chan_stock_selector.py` | 底背驰/顶背驰+买卖点 | 缠论交易者 |
| 多因子横截面 | `run_multi_factor.py` | 七大因子Z-score+加权排序 | 量化组合 |

## 通用用法

```bash
# 运行成长股策略（默认返回20只）
python run_growth_stock.py

# 指定返回数量
python run_growth_stock.py --limit 10

# 限定市值范围
python run_growth_stock.py --market-cap large

# 限定股票池
python run_growth_stock.py --stock-pool gem

# 结果保存到CSV
python run_growth_stock.py --output results.csv
```

## 通用参数

| 参数 | 说明 | 可选值 |
|------|------|--------|
| `--limit` | 返回股票数量 | 整数，默认 20 |
| `--market-cap` | 市值范围 | `large` / `mid` / `small` / `all` |
| `--stock-pool` | 股票池 | `all` / `main`(主板) / `gem`(创业板) / `star`(科创板) |
| `--output` | 结果保存路径 | CSV 文件路径（可选） |

## 数据源

各策略依赖 `backtrader_strategies/strategy_adapters/` 模块下的适配器从 Tushare Pro API 获取数据。需配置 `TUSHARE_TOKEN` 环境变量。
