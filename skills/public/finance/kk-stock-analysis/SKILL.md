---
name: kk-stock-analysis
description: A股个股十五维一体深度分析引擎——技术面+财务面+财报深度解读+筹码面+估值面+多模型估值+股本股东+事件统计+消息/机构/资讯层+实时行情+经营数据穿透+缠论分析+艾略特波浪+谐波形态+机器学习预测+社交媒体情绪分析，附10大智能选股策略。开箱即用的跨平台技能包，支持 OpenClaw/Claude Code/Qoder 等 Agent 架构。
version: 3.5.0
author: kk-quant
license: MIT
category: finance


package:
  type: python
  entry: scripts/analyze_stock_chan.py
capabilities:
  - id: technical-analysis
    description: "个股多周期技术分析：日/周/月线+5/15/30/60分钟微观线，MACD/RSI/KDJ/布林带/ATR/OBV"
  - id: financial-analysis
    description: "个股财务深度分析：营收/净利润趋势、毛利率/净利率、ROE/ROA、现金流质量"
  - id: chip-analysis
    description: "个股筹码分布分析：套牢盘集中区、获利盘比例、筹码密集度、支撑/压力区间"
  - id: valuation-analysis
    description: "个股估值分析：PE/PB/PS/PCF历史分位、行业横比、PE-Band、PB-ROE矩阵、估值陷阱检测"
  - id: news-tracking
    description: "个股新闻与舆情追踪：公司新闻、行业动态、风险预警"
  - id: institute-research
    description: "机构调研分析：调研频率、机构类型、调研方式、高频机构追踪"
  - id: earnings-forecast
    description: "券商盈利预测：EPS预测、净利润预测、评级分布、目标价"
  - id: margin-analysis
    description: "融资融券分析：融资余额变化、融券余额、杠杆资金热度"
  - id: realtime-quote
    description: "个股实时行情查询：价格、涨跌幅、成交量、主力资金流向、技术指标快照"
  - id: business-data
    description: "经营数据穿透：主营业务构成、客户/供应商、参控股公司、重大合同"
  - id: stock-selection
    description: "10大智能选股策略：价值投资/高股息/成长股/动量突破/技术突破/超跌反弹/涨停龙头/资金追踪/缠论背驰/多因子横截面"
  - id: news-search
    description: "财经资讯搜索：覆盖官媒/财经媒体/行业网站的实时新闻搜索"
  - id: chan-theory-analysis
    description: "缠论分析：分型识别、笔构建、线段构建、中枢识别、MACD背驰、三类买卖点、多级别联立"
  - id: chan-theory-selection
    description: "缠论背驰选股：MACD红绿柱面积对比、底背驰/顶背驰信号、全市场批量扫描"
  - id: elliott-wave-analysis
    description: "艾略特波浪分析：5浪推动+3浪调整结构、斐波那契关系校验、趋势见顶/调整完成信号"
  - id: harmonic-pattern-analysis
    description: "谐波形态分析：Gartley/Bat/Butterfly/Crab等XABCD五点形态、PRZ潜在反转区"
  - id: ml-trend-prediction
    description: "机器学习趋势预测：LightGBM/XGBoost/CatBoost集成模型、多源特征工程、置信度评分"
  - id: multi-valuation-models
    description: "多估值模型分析：DCF现金流折现+DDM股息折现+PE-Band历史分位+PB-ROE矩阵+EV/EBITDA+SOTP分部估值+10项估值陷阱检测+多模型交叉验证+综合目标价"
  - id: financial-deep-analysis
    description: "财报深度解读：三表勾稽验证、盈利质量评分卡、12项财务造假红旗检测、杜邦分析三级/五级分解、现金流质量矩阵、财报健康度综合评分"
  - id: social-media-sentiment
    description: "社交媒体情绪分析：雪球/东财股吧/淘股吧等多平台舆情采集、情绪评分、恐惧贪婪指数、情绪反转检测、价格-情绪背离分析"
  - id: shareholder-event-analysis
    description: "股本股东信息分析与事件统计：股本结构+股东户数趋势+前十大股东+股东增减持+实控人+股权质押风险+6类事件统计+股东面综合评分"
  - id: multi-factor-selection
    description: "多因子横截面选股：动量/反转/波动率/量比/PE/PB/ROE七大因子Z-score标准化+等权/自定义加权+TopN组合构建"
  - id: chart-visualization
    description: "生成分析可视化图表：雷达图、折线图、柱状图、饼图等26种图表"

permissions:
  network: true
  filesystem: true
  shell: true
  env:
    - TUSHARE_TOKEN
    - IWENCAI_API_KEY

requires:
  bins: ["python3"]
  env: ["TUSHARE_TOKEN", "IWENCAI_API_KEY"]

inputs:
  - name: stock
    type: string
    required: true
    description: "股票代码或名称，如 '600519'、'贵州茅台'、'600519.SH'"
  - name: analysis_type
    type: string
    required: false
    description: "分析类型：full(全面分析)、technical(技术面)、financial(财务面)、valuation(估值面)"

metadata:
  openclaw:
    emoji: "📊"
    version: "3.5.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - stock-analysis
      - A-share
      - fundamental-analysis
      - technical-analysis
      - stock-selection
      - tushare
      - iwencai
    requires:
      bins: ["python3"]
      env: ["TUSHARE_TOKEN", "IWENCAI_API_KEY"]
    install:
      - id: pip-deps
        kind: pip
        package: "tushare pandas numpy matplotlib scikit-learn lightgbm"
        python: python3
        label: "Install Python dependencies"

tags:
  - finance
  - stock-analysis
  - A-share
  - fundamental-analysis
  - technical-analysis
  - stock-selection
  - tushare
  - iwencai
---

# A股个股十五维一体深度分析引擎

## 技能概述

本技能包提供完整的A股个股分析能力，整合七大核心维度 + 8大高级分析模块 + 10大智能选股策略：

1. **技术面分析引擎** — 多周期K线+6大技术指标+支撑压力位
2. **财务面分析引擎** — 营收/利润/ROE/现金流全维度
3. **筹码面分析引擎** — 筹码分布+套牢盘/获利盘+股东结构
4. **估值面分析引擎** — PE/PB历史分位+PE-Band+PB-ROE+估值陷阱检测+多估值模型交叉验证
5. **消息/机构/资讯层** — 新闻+机构调研+券商盈利预测+实时资讯
6. **实时行情层** — 问财API实时价格/资金流向/技术指标快照
7. **经营数据穿透层** — 主营业务/客户/供应商/参控股/重大合同
8. **缠论分析引擎** — 形态学+动力学+多级别联立+三类买卖点
9. **艾略特波浪引擎** — 5浪推动+3浪调整+斐波那契校验
10. **谐波形态引擎** — Gartley/Bat/Butterfly/Crab XABCD五点形态
11. **机器学习预测引擎** — LightGBM/XGBoost/CatBoost集成预测
12. **社交媒体情绪引擎** — 多平台舆情采集+情绪评分+恐惧贪婪指数+反转检测
13. **财报深度解读引擎** — 三表勾稽+盈利质量评分+造假红旗检测+杜邦分析+现金流矩阵
14. **多估值模型引擎** — DCF+DDM+SOTP+PE-Band+PB-ROE+EV/EBITDA+估值陷阱+交叉验证+目标价
15. **股本股东+事件统计引擎** — 股本结构+股东户数趋势+前十大股东+增减持+实控人+质押风险+6类事件统计

## 分析脚本列表

### 个股分析脚本（`scripts/analysis-engine/`）

| 脚本文件 | 功能 | 参数 |
|---------|------|------|
| `analyze_technical.py` | 多周期技术分析（日/周/月+5/15/30/60分钟） | `--stock 600519.SH --json` |
| `analyze_financial_report.py` | 财务分析（营收/利润/ROE/现金流） | `--stock 600519.SH --json` |
| `analyze_financial_deep.py` | 财报深度解读（三表勾稽+盈利质量+造假红旗+杜邦分析+现金流矩阵） | `--stock 600519.SH --years 3 --json` |
| `analyze_stock_chips.py` | 筹码分布（套牢盘/获利盘/支撑压力） | `--stock 600519.SH --json` |
| `analyze_stock_valuation.py` | 估值分析（PE/PB/PS/PCF+PE-Band+估值陷阱） | `--stock 600519.SH --json` |
| `analyze_valuation_models.py` | 多估值模型分析（DCF+DDM+PE-Band+PB-ROE+EV/EBITDA+估值陷阱+交叉验证+目标价） | `--stock 600519.SH --years 5 --json` |
| `analyze_stock_company_info.py` | 公司基本信息 | `--stock 600519.SH --json` |
| `analyze_stock_shareholder.py` | 股本股东信息+事件统计（股本结构+股东户数+前十大+增减持+实控人+质押+6类事件+综合评分） | `--stock 600519.SH --json` |
| `analyze_stock_news.py` | 公司新闻与行业动态（问财 news-search API） | `--stock 600519.SH --json` |
| `analyze_stock_institute_research.py` | 机构调研分析 | `--stock 600519.SH --json` |
| `analyze_stock_earnings_forecast.py` | 券商盈利预测 | `--stock 600519.SH --json` |
| `analyze_stock_margin.py` | 融资融券分析 | `--stock 600519.SH --json` |

### 高级分析脚本（`scripts/analysis-engine/`）

| 脚本文件 | 功能 | 参数 |
|---------|------|------|
| `analyze_stock_chan.py` | 缠论分析（分型/笔/线段/中枢/MACD背驰/三类买卖点） | `--stock 600519.SH --json` |
| `analyze_elliott_wave.py` | 艾略特波浪分析（5浪推动+3浪调整+斐波那契校验） | `--stock 600519.SH --json` |
| `analyze_harmonic_pattern.py` | 谐波形态分析（Gartley/Bat/Butterfly/Crab XABCD） | `--stock 600519.SH --json` |
| `analyze_trend_prediction.py` | 机器学习趋势预测（LightGBM/XGBoost/CatBoost集成） | `--stock 600519.SH --json` |
| `analyze_social_media.py` | 社交媒体情绪分析（多平台舆情+情绪评分+恐惧贪婪指数+反转检测） | `--stock 600519.SH --days 7 --json` |

### 智能选股策略（`scripts/selection-strategies/`）

| 脚本文件 | 策略 | 说明 |
|---------|------|------|
| `run_value_investment.py` | 价值投资 | 低PE/PB、高ROE的低估优质股 |
| `run_high_dividend.py` | 高股息 | 股息率高、分红稳定的防御型 |
| `run_growth_stock.py` | 成长股 | 营收/利润高速增长 |
| `run_momentum_breakthrough.py` | 动量突破 | 价格突破关键阻力位 |
| `run_technical_breakthrough.py` | 技术突破 | 均线/形态突破+量能确认 |
| `run_oversold_rebound.py` | 超跌反弹 | RSI/KDJ极度超卖后均值回归 |
| `run_limit_up_leader.py` | 涨停龙头 | 连板强势股的趋势延续 |
| `run_fund_flow_tracking.py` | 资金追踪 | 跟随主力大单净流入方向 |
| `run_chan_stock_selector.py` | 缠论背驰选股 | MACD背驰信号全市场扫描 |
| `run_multi_factor.py` | 多因子横截面 | 7大因子截面Z-score标准化+等权/加权评分+TopN组合 |

### ML 训练脚本（`scripts/ml-prediction/`）

| 脚本文件 | 功能 | 参数 |
|---------|------|------|
| `run_model_train.py` | 趋势预测模型训练（LightGBM/XGBoost/CatBoost） | `--json` |

### CLI 工具（`scripts/`）

| 文件 | 用途 |
|------|------|
| `market-query-cli.py` | 问财实时行情查询（个股行情/资金/技术指标） |
| `business-query-cli.py` | 经营数据穿透（主营/客户/供应商/合同） |
| `management-query-cli.py` | 股东管理数据（股本/股东/实控人/质押） |

## 脚本调用方式

```bash
# =================== 基础分析 ===================

# 个股全面技术分析
python3 scripts/analysis-engine/analyze_technical.py --stock 600519.SH --json

# 财务分析
python3 scripts/analysis-engine/analyze_financial_report.py --stock 600519.SH --json

# 筹码分析
python3 scripts/analysis-engine/analyze_stock_chips.py --stock 600519.SH --json

# 估值分析（含PE-Band+估值陷阱检测）
python3 scripts/analysis-engine/analyze_stock_valuation.py --stock 600519.SH --json

| `run_fund_flow_tracking.py` | 资金追踪 | 跟随主力大单净流入方向 |
| `run_chan_stock_selector.py` | 缠论背驰选股 | MACD背驰信号全市场扫描 |
| `run_multi_factor.py` | 多因子横截面 | 7大因子截面Z-score标准化+等权/加权评分+TopN组合 |
python3 scripts/analysis-engine/analyze_valuation_models.py --stock 600519.SH --years 5 --json

# 机构调研分析
python3 scripts/analysis-engine/analyze_stock_institute_research.py --stock 600519.SH --json

# 券商盈利预测
python3 scripts/analysis-engine/analyze_stock_earnings_forecast.py --stock 600519.SH --json

# 融资融券分析
python3 scripts/analysis-engine/analyze_stock_margin.py --stock 600519.SH --json

# =================== 高级分析 ===================

# 缠论分析（单级别/多级别联立）
python3 scripts/analysis-engine/analyze_stock_chan.py --stock 600519.SH --json
python3 scripts/analysis-engine/analyze_stock_chan.py --stock 茅台 --multi-level --json

# 艾略特波浪分析
python3 scripts/analysis-engine/analyze_elliott_wave.py --stock 600519.SH --json
python3 scripts/analysis-engine/analyze_elliott_wave.py --stock 600519.SH --swing-window 15 --json

# 谐波形态分析
python3 scripts/analysis-engine/analyze_harmonic_pattern.py --stock 600519.SH --json

# 机器学习趋势预测
python3 scripts/analysis-engine/analyze_trend_prediction.py --stock 600519.SH --json

# 社交媒体情绪分析
python3 scripts/analysis-engine/analyze_social_media.py --stock 600519.SH --json
python3 scripts/analysis-engine/analyze_social_media.py --stock 600519.SH --days 14 --json

# 财报深度解读
python3 scripts/analysis-engine/analyze_financial_deep.py --stock 600519.SH --json
python3 scripts/analysis-engine/analyze_financial_deep.py --stock 600519.SH --years 5 --json

# =================== 实时行情/经营数据 ===================

# 实时行情查询
python3 scripts/market-query-cli.py --query "贵州茅台实时行情"

# 经营数据穿透
python3 scripts/business-query-cli.py --query "贵州茅台主营业务构成"

# 股东管理数据
python3 scripts/management-query-cli.py --query "贵州茅台股本结构"

# =================== 智能选股 ===================

# 价值投资策略
python3 scripts/selection-strategies/run_value_investment.py --json

# 高股息策略
python3 scripts/selection-strategies/run_high_dividend.py --json

# 缠论背驰选股（全市场/指定股票池）
python3 scripts/selection-strategies/run_chan_stock_selector.py --json
python3 scripts/selection-strategies/run_chan_stock_selector.py --pool hs300 --signal buy --json

# 多因子横截面选股（7因子Z-score+TopN等权组合）
python3 scripts/selection-strategies/run_multi_factor.py --json
python3 scripts/selection-strategies/run_multi_factor.py --top-n 20 --momentum-window 10 --json

# =================== 模型训练 ===================

# 多估值模型分析（DCF+DDM+PE-Band+PB-ROE+EV/EBITDA+交叉验证）
python3 scripts/analysis-engine/analyze_valuation_models.py --stock 600519.SH --json
python3 scripts/analysis-engine/analyze_valuation_models.py --stock 600519.SH --years 5 --json

# 趋势预测模型训练
python3 scripts/ml-prediction/run_model_train.py --json
python3 scripts/ml-prediction/run_model_train.py --stocks 000001.SZ,600519.SH --json
```

## 十五维分析执行流程

### 阶段一：并行数据采集（15路并发）

**维度1: 技术面** — analyze_technical.py
**维度2: 财务面** — analyze_financial_report.py
**维度3: 财报深度解读** — analyze_financial_deep.py（三表勾稽+盈利质量+造假红旗+杜邦分析+现金流矩阵）
**维度4: 筹码面** — analyze_stock_chips.py + management-query-cli.py
**维度5: 估值面** — analyze_stock_valuation.py
**维度6: 多估值模型** — analyze_valuation_models.py（DCF+DDM+PE-Band+PB-ROE+EV/EBITDA+估值陷阱+交叉验证+目标价）
**维度7: 股本股东+事件统计** — analyze_stock_shareholder.py（股本结构+股东户数+前十大+增减持+实控人+质押+6类事件）
**维度8: 消息/机构/资讯** — analyze_stock_news.py（问财 news-search API）+ analyze_stock_institute_research.py + analyze_stock_earnings_forecast.py + news-search API
**维度9: 实时行情** — market-query-cli.py
**维度10: 经营数据** — business-query-cli.py（主营/客户/供应商/合同）
**维度11: 缠论分析** — analyze_stock_chan.py（形态学+动力学+多级别联立+三类买卖点）
**维度12: 艾略特波浪** — analyze_elliott_wave.py（5浪推动+3浪调整+斐波那契校验）
**维度13: 谐波形态** — analyze_harmonic_pattern.py（Gartley/Bat/Butterfly/Crab XABCD）
**维度14: 机器学习预测** — analyze_trend_prediction.py（LightGBM/XGBoost/CatBoost集成）
**维度15: 社交媒体情绪** — analyze_social_media.py（多平台舆情+情绪评分+恐惧贪婪指数+反转检测）

### 阶段二：数据融合与交叉验证

十五维数据融合策略：
1. **财务 x 经营**：利润表质量 x 收入结构 — 判断营收真实性
2. **财报深度 x 估值**：三表勾稽验证 x 估值分位 — 验证盈利支撑估值的合理性
3. **资金 x 合同**：实时资金流向 x 重大合同 — 识别主力布局
4. **估值 x 业务**：PE/PB分位 x 主营变化 — 判断估值匹配度
5. **筹码 x 供应链**：筹码分布 x 客户/供应商集中度 — 评估机构持仓逻辑
6. **资讯 x 行情**：新闻热点 x 资金流向 — 验证市场反应方向
7. **缠论 x 波浪**：缠论买卖点 x 波浪结构位置 — 双理论交叉验证
8. **波浪 x 谐波**：波浪阶段 x 谐波形态PRZ — 精确反转点位
9. **ML x 技术面**：机器学习预测方向 x 传统技术指标信号 — AI+传统双验证
11. **多模型估值 x 财报深度**：DCF/PE-Band等估值结果 x 三表勾稽质量 — 验证估值假设的财务支撑
13. **股东 x 事件**：股东增减持方向 x 监管函/解禁事件 — 内部人行为 vs 外部事件交叉验证
14. **质押 x 估值**：质押风险 x 多模型估值 — 高质押低估值的陷阱识别

### 阶段三：报告输出

十五维综合评分（0-100），权重分配：
| 维度 | 权重 | 说明 |
|------|------|------|
| 技术面 | 6% | 趋势与买卖点 |
| 财务面 | 8% | 盈利质量与成长性 |
| 财报深度解读 | 8% | 三表勾稽+造假红旗+杜邦分析 |
| 筹码面 | 6% | 主力动向 |
| 估值面 | 7% | 安全边际 |
| 多估值模型 | 8% | DCF+DDM+EV/EBITDA交叉验证 |
| 股本股东+事件 | 6% | 股东面健康度+事件风险 |
| 消息+机构+资讯 | 6% | 情绪、预期与事件驱动 |
| 实时行情 | 4% | 短期动能 |
| 经营面 | 8% | 业务实质与护城河 |
| 缠论分析 | 7% | 形态动力学信号 |
| 艾略特波浪 | 4% | 波浪结构判断 |
| 谐波形态 | 4% | PRZ反转信号 |
| 机器学习预测 | 7% | AI趋势预测 |
| 社交媒体情绪 | 5% | 舆情与情绪驱动 |

## 环境变量

| 变量 | 必填 | 说明 | 获取方式 |
|------|------|------|---------|
| `TUSHARE_TOKEN` | 是 | Tushare Pro API密钥 | https://tushare.pro |
| `IWENCAI_API_KEY` | 是 | 同花顺问财API密钥 | https://www.iwencai.com/skillhub |

## Python 依赖

```
tushare>=1.4.0
pandas>=2.0.0
numpy>=1.24.0
matplotlib>=3.7.0
scikit-learn>=1.3.0
lightgbm>=4.0.0
```

## 数据来源标注

- 量化引擎数据标注「数据来源于Tushare Pro API（T+1延迟）」
- 实时行情数据标注「数据来源于同花顺问财（实时）」
- 经营数据标注「数据来源于同花顺问财」
- 资讯搜索标注「数据来源于同花顺问财」

## 数据约定

- 深圳股票代码：`XXXXXX.SZ`（如 `000001.SZ`）
- 上海股票代码：`XXXXXX.SH`（如 `600519.SH`）
- 日期格式：`YYYYMMDD`

## 注意事项

1. 分析结果仅供参考，不构成投资建议
2. 量化引擎数据为 T+1 延迟，实时数据通过问财API补充
3. 经营层子维度可按需查询，常规分析建议至少覆盖主营业务+主要客户
4. analyze_stock_news 通过问财 news-search API 搜索新闻，不再依赖本地数据库
