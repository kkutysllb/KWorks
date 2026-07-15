---
name: kk-futures-analysis
description: A股股指期货四维一体深度分析引擎——行情趋势（K线/均线/OI）+贴升水分析（基差/期限结构/市场情绪）+机构持仓（前20席位多空/中信风向标）+综合研判（100分评分/品种分化/策略建议），开箱即用的跨平台技能包。
version: 1.0.0
author: kk-quant
license: MIT
category: finance


package:
  type: python
  entry: scripts/analysis-engine/analyze_futures.py
capabilities:
  - id: daily-futures-analysis
    description: "日度股指期货行情分析：活跃合约识别、K线趋势、均线、振幅、OI变化"
  - id: weekly-futures-analysis
    description: "周度股指期货分析：周内日线走势、周涨跌幅、基差周均值、周末持仓快照"
  - id: contango-analysis
    description: "贴升水分析：基差/基差率/期限结构/升贴水信号/市场情绪判断"
  - id: holding-analysis
    description: "机构持仓分析：前20大席位多空排名、中信期货风向标、其他19家对比、净持仓变化信号"
  - id: composite-judgment
    description: "综合研判：100分评分模型、品种分化对比、多空环境判断、投资策略建议"

permissions:
  network: true
  filesystem: true
  shell: true
  env:
    - TUSHARE_TOKEN

requires:
  bins: ["python3"]
  env: ["TUSHARE_TOKEN"]

inputs:
  - name: query
    type: string
    required: true
    description: "分析需求，如'股指期货分析'、'IF持仓分析'、'期货贴升水'、'周度期货'"

metadata:
  openclaw:
    emoji: "📊"
    version: "1.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - futures
      - stock-index-futures
      - quantitative-analysis
      - A-share
      - tushare
    requires:
      bins: ["python3"]
      env: ["TUSHARE_TOKEN"]
    install:
      - id: pip-deps
        kind: pip
        package: "tushare pandas numpy pydantic"
        python: python3
        label: "Install Python dependencies"
      - id: setup-env
        kind: manual
        instructions: "请配置环境变量 TUSHARE_TOKEN（Tushare Pro API密钥）"
        label: "Configure API key"

tags:
  - finance
  - futures
  - stock-index-futures
  - quantitative-analysis
  - A-share
  - tushare
---

# A股股指期货四维一体深度分析引擎

## 技能概述

本技能包提供完整的股指期货分析能力，覆盖四大品种（IF/IC/IH/IM），整合四个核心维度：

1. **行情趋势** — 活跃合约识别、K线趋势、均线系统、振幅、OI变化
2. **贴升水分析** — 基差/基差率、期限结构、升贴水信号、市场情绪判断
3. **机构持仓** — 前20大席位多空排名、中信期货风向标、其他19家对比、净持仓变化
4. **综合研判** — 100分评分模型、品种分化对比、多空环境判断、投资策略建议

### 覆盖品种

| 代码 | 品种 | 对应现货指数 |
|------|------|-------------|
| IF | 沪深300期货 | 000300.SH |
| IC | 中证500期货 | 000905.SH |
| IH | 上证50期货 | 000016.SH |
| IM | 中证1000期货 | 000852.SH |

## 分析脚本

> 所有脚本位于 `scripts/analysis-engine/` 目录，依赖内嵌引擎 `scripts/analysis/`（自包含）。

### 脚本列表

| 脚本文件 | 功能 | 参数 |
|---------|------|------|
| `analyze_futures.py` | 日度股指期货综合分析 | `--symbols IF IC IH IM --type all\|price\|contango\|holding\|composite --days N --json --save` |
| `analyze_weekly_futures.py` | 周度股指期货综合分析 | `--weeks N --json --save` |

### 日度分析（analyze_futures.py）

```bash
# 全量分析（默认IF/IC/IH/IM四大品种）
python3 scripts/analysis-engine/analyze_futures.py --json

# 指定品种和分析类型
python3 scripts/analysis-engine/analyze_futures.py --symbols IF IC --type holding --json

# 贴升水分析
python3 scripts/analysis-engine/analyze_futures.py --type contango --json

# 指定回溯天数
python3 scripts/analysis-engine/analyze_futures.py --days 60 --json
```

### 周度分析（analyze_weekly_futures.py）

```bash
# 分析上周
python3 scripts/analysis-engine/analyze_weekly_futures.py --json

# 分析上上周
python3 scripts/analysis-engine/analyze_weekly_futures.py --weeks 1 --json
```

## 四维分析执行流程

### 阶段一：数据采集（Tushare Pro API）

1. **活跃合约识别** — CFFEX交易所股指期货合约列表、主力合约筛选
2. **行情数据** — 主力合约日线行情（OHLC/V/OI）
3. **现货指数** — 对应现货指数日线数据
4. **全合约数据** — 所有活跃合约近5日数据（用于期限结构）
5. **机构持仓** — 前20大席位多空持仓排名

### 阶段二：四维分析

**维度1: 行情趋势**
- K线趋势判断（MA5/MA10/MA20多头/空头排列）
- 振幅分析、成交量变化、持仓量变化

**维度2: 贴升水分析**
- 近月基差 = 期货收盘价 - 现货收盘价
- 基差率 = 基差 / 现货收盘价 × 100%
- 期限结构（近月→远月基差率递增/递减）
- 升贴水信号判断

**维度3: 机构持仓**
- 前20大席位多头合计/空头合计/净持仓/多空比
- 中信期货净持仓（市场风向标）
- 其他19家 vs 中信对比
- 持仓变化信号（多头加减/空头加减）

**维度4: 综合研判**
- 趋势评分（0-100）+ 情绪评分（0-100）+ 持仓评分（0-100）
- 加权综合评分（100分制）
- 市场环境判断（偏多/中性偏多/中性/中性偏空/偏空）
- 品种分化对比
- 投资策略建议

### 阶段三：报告输出

1. 市场概览（综合评分 + 市场环境 + 品种评分）
2. 逐品种详细分析（行情 + 贴升水 + 持仓）
3. 综合研判（多空环境 + 策略建议）
4. 投资建议
5. 风险提示

## 环境变量

| 变量 | 必填 | 说明 | 获取方式 |
|------|------|------|---------|
| `TUSHARE_TOKEN` | 是 | Tushare Pro API密钥 | https://tushare.pro 注册获取 |

## Python 依赖

```
tushare>=1.4.0
pandas>=2.0.0
numpy>=1.24.0
pydantic>=2.0.0
```

## 数据来源标注

- 所有日频数据标注「数据来源于 Tushare Pro API（通常每日 18:00 后更新，具体以接口返回为准）」
- 机构持仓数据为前20大席位汇总，非全市场
- 中信期货持仓单独列出作为市场风向标

## 注意事项

1. Tushare 日频数据通常每日 18:00 后更新，不应标注为固定 T+1
2. 期货基差分析需结合持仓量变化综合判断
3. 中信期货持仓信号仅作参考，单一机构无法决定市场方向
4. 期限结构分析需要至少3个活跃合约
5. 分析结果仅供参考，不构成投资建议
