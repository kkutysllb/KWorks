---
name: kk-etf-analysis
description: ETF全维度分析技能包——双引擎驱动（Tushare Pro 量化数据层 + 问财实时筛选层），支持13项ETF分析维度（列表/行情/净值/份额/规模/五类分类/跟踪指数/行业ETF/横向对比/持仓/经理/分红）和自然语言智能筛选，开箱即用的跨平台技能包。
version: 1.0.0
author: kk-quant
license: MIT
category: finance


package:
  type: python
  entry: scripts/cli.py
capabilities:
  - id: etf-list
    description: "ETF列表查询（含五类分类标签：宽基/行业/商品/货币/跨境）"
  - id: etf-daily
    description: "ETF日行情：收盘价/涨跌幅/成交额/换手率"
  - id: etf-nav
    description: "ETF历史净值：单位净值/累计净值"
  - id: etf-shares
    description: "ETF份额变化：每日场内份额及环比变化"
  - id: etf-scale
    description: "ETF规模分析：30日日均成交额+估算规模"
  - id: etf-classify
    description: "五类ETF分类概览：宽基/行业/跨境/商品/货币"
  - id: etf-screen
    description: "多条件ETF筛选：按类型/规模/涨跌幅等"
  - id: etf-index
    description: "跟踪指数分析：指数代码/编制机构/指数行情"
  - id: etf-sector
    description: "行业ETF查询：按行业关键词匹配"
  - id: etf-compare
    description: "多ETF横向对比：价格/收益率/规模/费率"
  - id: etf-portfolio
    description: "持仓分析：十大重仓股"
  - id: etf-managers
    description: "基金经理查询"
  - id: etf-dividends
    description: "分红记录查询"
  - id: etf-selector
    description: "问财智能选ETF：自然语言筛选，实时数据"

permissions:
  network: true
  filesystem: true
  shell: true
  env:
    - TUSHARE_TOKEN
    - IWENCAI_API_KEY

requires:
  bins: ["python3"]
  env: ["TUSHARE_TOKEN"]

inputs:
  - name: query
    type: string
    required: true
    description: "ETF查询需求，如 '510300 ETF行情'、'沪深300ETF有哪些'、'黄金ETF'"

metadata:
  openclaw:
    emoji: "📈"
    version: "1.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - ETF
      - A-share
      - tushare
      - iwencai
    requires:
      bins: ["python3"]
      env: ["TUSHARE_TOKEN"]
    install:
      - id: pip-deps
        kind: pip
        package: "tushare pandas"
        python: python3
        label: "Install Python dependencies"
      - id: setup-env
        kind: manual
        instructions: "请配置环境变量 TUSHARE_TOKEN（Tushare Pro API密钥）和 IWENCAI_API_KEY（同花顺问财API密钥）"
        label: "Configure API keys"

tags:
  - finance
  - ETF
  - A-share
  - tushare
  - iwencai
---

# kk-etf-analysis — ETF 全维度分析技能包

## 概述

本技能包整合双引擎提供 ETF 全维度分析能力：

| 引擎 | 数据源 | 特点 | 适用场景 |
|------|--------|------|---------|
| **tushare** | Tushare Pro API | 结构化数据、13种分析维度 | 行情/净值/份额/规模/分类/对比 |
| **selector** | 同花顺问财 OpenAPI | 自然语言查询、实时数据 | 智能筛选/组合条件查询 |

## 使用方式

### 引擎1: Tushare — 结构化 ETF 分析

```bash
# ETF列表（含分类标签）
python3 scripts/cli.py tushare list --params market=E limit=20

# 日行情
python3 scripts/cli.py tushare daily --params ts_code=510300.SH start_date=2026-01-01

# 历史净值
python3 scripts/cli.py tushare nav --params ts_code=510300.SH limit=60

# 份额变化
python3 scripts/cli.py tushare shares --params ts_code=510300.SH limit=60

# 规模分析
python3 scripts/cli.py tushare scale --params ts_code=510300.SH

# 五类ETF分类概览
python3 scripts/cli.py tushare classify --params limit=5

# 分类筛选
python3 scripts/cli.py tushare screen --params etf_type=宽基ETF limit=10
python3 scripts/cli.py tushare screen --params etf_type=行业/主题ETF limit=10
python3 scripts/cli.py tushare screen --params etf_type=商品ETF limit=10
python3 scripts/cli.py tushare screen --params etf_type=货币ETF limit=10
python3 scripts/cli.py tushare screen --params etf_type=跨境ETF limit=10

# 跟踪指数分析
python3 scripts/cli.py tushare index --params ts_code=510300.SH

# 行业ETF
python3 scripts/cli.py tushare sector --params sector=半导体 limit=10

# 横向对比
python3 scripts/cli.py tushare compare --params ts_codes=510300.SH,159919.SZ,510500.SH

# 持仓分析
python3 scripts/cli.py tushare portfolio --params ts_code=510300.SH

# 基金经理
python3 scripts/cli.py tushare managers --params ts_code=510300.SH

# 分红记录
python3 scripts/cli.py tushare dividends --params ts_code=510300.SH
```

### 引擎2: 问财 — 自然语言 ETF 筛选

```bash
# 智能筛选（自然语言）
python3 scripts/cli.py selector --query "沪深300ETF有哪些？"
python3 scripts/cli.py selector --query "规模最大的ETF" --page 1 --limit 20
python3 scripts/cli.py selector --query "创业板ETF"
python3 scripts/cli.py selector --query "黄金ETF" --call-type retry --timeout 60
```

## 问题路由

| 用户问题 | 引擎 | 调用 |
|---------|------|------|
| "帮我分析 XXX ETF" | tushare | `daily` + `nav` + `scale` + `index` |
| "哪些半导体 ETF？" | tushare | `sector sector=半导体` |
| "宽基ETF有哪些？" | tushare + selector | `screen` + 问财筛选 |
| "黄金ETF有哪些？" | tushare | `screen etf_type=商品ETF` |
| "帮我对比510300和159919" | tushare | `compare` |
| "ETF份额最近怎么变化" | tushare | `shares` |
| "各类ETF今天表现如何" | tushare | `classify` |
| "基金规模最大的ETF" | selector | 自然语言筛选 |
| "近一年收益最好的ETF" | selector | 自然语言筛选 |

## 五类 ETF 分类系统

| 类型 | 判断标准 | 典型标的 |
|------|---------|---------|
| **宽基ETF** | 跟踪规模指数 | 510300(沪深300)、588000(科创50) |
| **行业/主题ETF** | 跟踪行业/主题指数 | 512480(半导体)、515790(光伏) |
| **跨境ETF** | 跟踪境外指数 | 513100(纳斯达克)、159920(恒生ETF) |
| **商品ETF** | 跟踪黄金/原油/农产品 | 518880(黄金ETF)、159866(豆粕ETF) |
| **货币ETF** | 货币市场型 | 511990(华泰天天金) |

## 环境要求

| 环境变量 | 必需 | 说明 |
|---------|------|------|
| `TUSHARE_TOKEN` | 是(tushare引擎) | Tushare Pro API Token |
| `IWENCAI_API_KEY` | 是(selector引擎) | 问财 OpenAPI Key |

## Python 依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| tushare | >=1.4 | Tushare Pro 数据接口 |
| pandas | >=1.5 | 数据处理（tushare自动安装） |

问财引擎为纯标准库实现，无第三方依赖。

## 注意事项

- **数据延迟**: Tushare ETF 数据为 T+1
- **份额信号**: 份额增加→资金净申购（利好）；份额减少→资金净赎回（警示）
- **规模估算**: `估算规模 = 单位净值 × 最新份额`，为近似值
- **成交额单位**: 内部自动转换为"亿元"
- **问节数据需标注**: "数据来源于同花顺问财"
- **分析结果仅供参考，不构成投资建议**
