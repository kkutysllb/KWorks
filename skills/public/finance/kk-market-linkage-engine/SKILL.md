---
name: kk-market-linkage-engine
description: |
  A 股市场联动分析引擎。独立、可复用的多维度资金与情绪联动分析工具，覆盖 8 大维度：
  主力资金流向、北向资金流向、两融趋势、股指期货基差、7 大期权 ETF 波动率、
  9 大宽基 ETF 份额变化、Shibor 利率走势、龙虎榜分析。
  数据源：Tushare Pro API + 同花顺问财 OpenAPI。
  输出：日度/周度联动报告 + 综合情绪评分 + 一句话市场总结。
license: MIT
category: finance
version: 1.0.0
author: kk-quant
tags:
  - A股
  - 市场联动
  - 资金流向
  - 北向资金
  - 两融
  - 期权波动率
  - ETF份额
  - Shibor
  - 龙虎榜


package:
  type: knowledge-only
capabilities:
  - id: main-capital-flow
    description: "主力资金流向分析：个股/板块净流入、全市场净额、流入流出比"
  - id: north-bound-flow
    description: "北向资金流向分析：沪深股通净额、连续性、十大活跃股"
  - id: margin-trend
    description: "两融趋势分析：融资余额趋势、净买入额、杠杆水平"
  - id: futures-basis
    description: "股指期货基差分析：IF/IC/IH/IM升贴水、基差率、多空持仓"
  - id: option-volatility
    description: "期权ETF波动率分析：PCR、IV、认购/认沽活跃度"
  - id: etf-share-change
    description: "宽基ETF份额变化：份额净申赎、与价格背离/同步"
  - id: shibor-rate
    description: "Shibor利率走势：各期限利率变化、期限利差、流动性松紧"
  - id: top-list
    description: "龙虎榜分析：上榜个股、机构净买卖、热度评分"

permissions:
  network: true
  filesystem: true
  shell: true

metadata:
  openclaw:
    emoji: "🔗"
    version: "1.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - A股
      - 市场联动
      - 资金流向
      - 北向资金
      - 两融
      - 期权波动率
      - ETF份额
      - Shibor
      - 龙虎榜

requires:
  bins: ["python3"]
  env: ["TUSHARE_TOKEN"]
---

# kk-market-linkage-engine

A 股市场联动分析引擎 — 通过 8 大资金与情绪维度的交叉验证，判断市场整体方向与结构性强弱。

## ⚠️ 重要：无需安装任何依赖

**本技能及其所有依赖（kk-common、tushare、pandas 等）已在运行环境中预装完毕。**
**直接运行下方的命令即可，绝对禁止执行 pip install、npm install 或任何其他安装命令。**
**不要尝试安装 kk-common 或任何其他依赖包——它们已经就绪。**

## 触发场景

当需要分析以下内容时使用本技能：
- A 股市场整体资金面与情绪面联动分析
- 主力资金、北向资金、两融等多维度资金流向综合判断
- 期权波动率、ETF 份额变化、Shibor 利率等衍生/宏观指标联动
- 生成日度/周度市场联动分析报告
- 龙虎榜机构与游资动向分析

## 核心能力

### 八大分析维度

| # | 维度 | 数据源 | 信号逻辑 |
|---|------|--------|----------|
| 1 | **主力资金流向** | Tushare `moneyflow` / `moneyflow_dc` | 个股/板块净流入、全市场净额、流入流出比 |
| 2 | **北向资金流向** | Tushare `moneyflow_hsgt` / `hsgt_top10` | 沪深股通净额、连续性（连续N日）、十大活跃股 |
| 3 | **两融趋势** | Tushare `margin` / `margin_detail` | 融资余额趋势、净买入额、杠杆水平 |
| 4 | **股指期货基差** | Tushare `fut_daily` / `index_daily` | IF/IC/IH/IM 升贴水、基差率、多空持仓 |
| 5 | **7 大期权 ETF 波动率** | Tushare `opt_daily` | PCR（认沽认购比）、IV、认购/认沽活跃度 |
| 6 | **9 大宽基 ETF 份额** | Tushare `fund_share` / `fund_daily` | 份额净申赎、与价格背离/同步 |
| 7 | **Shibor 利率走势** | Tushare `shibor` / `shibor_lpr` | 各期限利率变化、期限利差、流动性松紧 |
| 8 | **龙虎榜分析** | Tushare `top_list` / `top_inst` | 上榜个股、机构净买卖、热度评分 |

### 综合评分体系

每个维度输出：
- **score** (0-100)：>60 偏多，<40 偏空
- **bias** (bullish/bearish/neutral)：维度偏向
- **signals**：具体信号列表（含 emoji 标识）

引擎聚合 8 维度：
- **avg_score**：综合均分
- **bull/bear 计数**：偏多/偏空维度数
- **sentiment**：综合情绪（偏多/偏空/中性震荡）
- **action**：操作建议

## 用法

### 命令行（直接运行，无需安装）

```bash
# 日度分析
python -m market_linkage_engine daily
python -m market_linkage_engine daily 20240105

# 周度分析（中期趋势）
python -m market_linkage_engine weekly

# 启用问财实时数据
python -m market_linkage_engine daily --iwencai

# 输出格式
python -m market_linkage_engine daily -f markdown   # 默认，完整报告
python -m market_linkage_engine daily -f json        # 结构化 JSON
python -m market_linkage_engine daily -f summary     # 一句话总结

# 写入文件
python -m market_linkage_engine daily -o report.md
```

### Python API（直接导入，无需安装）

```python
from market_linkage_engine import LinkageEngine

engine = LinkageEngine()
daily = engine.run_daily(trade_date="20240105")
weekly = engine.run_weekly(end_date="20240105")

print(engine.to_summary(daily))    # 一句话总结
print(engine.to_markdown(daily))   # 完整 Markdown 报告

# 访问单维度结果
main_capital = daily["dimensions"]["main_capital"]
print(main_capital["score"], main_capital["signals"])
```

## 数据源说明

| 数据源 | 时效 | 用途 |
|--------|------|------|
| **Tushare Pro API** | 每日 18:00 后更新 | 结构化历史数据（主要数据源，具体以接口返回为准） |
| **同花顺问财 OpenAPI** | 实时/盘中 | 实时数据补充（可选，`--iwencai` 启用） |

## 环境变量

凭证已在本机环境变量中配置，直接使用即可：

```bash
TUSHARE_TOKEN        # 必需，已配置
IWENCAI_API_KEY      # 可选（启用问财时），已配置
```

## 架构

详见 [README.md](./README.md)。引擎采用分层架构：
- **数据层** (`data/fetcher.py`)：统一封装 Tushare + 问财数据获取
- **分析层** (`analyzers/`)：8 大维度各自独立的分析器
- **编排层** (`engine.py`)：聚合分析、生成报告、综合评分
