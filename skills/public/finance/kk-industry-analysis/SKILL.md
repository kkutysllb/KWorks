---
name: kk-industry-analysis
description: A股行业六维一体深度分析引擎——结构层（产业链上中下游拆解）+数据层（行业估值/财务/盈利排名）+框架层（五模块产业链解读）+研究层（券商研报）+资讯层（实时财经资讯）+宏观框架层（全球宏观周期定位），开箱即用的跨平台技能包。
version: 2.0.0
author: kk-quant
license: MIT
category: finance


package:
  type: python
  entry: scripts/analyze_industry.py
capabilities:
  - id: industry-chain-analysis
    description: "产业链结构分析：上游/中游/下游拆解、核心公司识别、市值分布、PE、利润增长"
  - id: industry-data-query
    description: "行业数据查询：估值排名、财务指标、盈利数据、板块行情、涨跌幅排名"
  - id: industry-framework
    description: "五模块产业链解读框架：顶层评估→核心驱动→产业本质→产业链拆解→风险验证"
  - id: report-search
    description: "券商研报搜索：行业研究报告、机构评级、目标价、投资逻辑摘要"
  - id: news-search
    description: "行业资讯搜索：实时财经资讯、政策动态、技术突破、竞争格局、投融资"
  - id: global-macro
    description: "全球宏观框架：宏观周期定位、加息/降息周期行业映射、美元/地缘风险传导"
  - id: chart-visualization
    description: "行业图表可视化：前端ECharts图表配置（产业链桑基图、市值柱状图、行业饼图）"

permissions:
  network: true
  filesystem: true
  shell: true
  env:
    - IWENCAI_API_KEY

requires:
  bins: ["python3"]
  env: ["IWENCAI_API_KEY"]

inputs:
  - name: industry
    type: string
    required: true
    description: "行业名称，如 '新能源汽车'、'半导体'、'人工智能'、'商业航天'"
  - name: depth
    type: string
    required: false
    description: "分析深度：quick(快速评估)、standard(标准分析)、detailed(深度研判)"

metadata:
  openclaw:
    emoji: "🏭"
    version: "2.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - industry-analysis
      - industry-chain
      - A-share
      - fundamental-analysis
      - iwencai
      - pywencai
    requires:
      bins: ["python3"]
      env: ["IWENCAI_API_KEY"]
    install:
      - id: pip-deps
        kind: pip
        package: "pywencai pandas pydantic"
        python: python3
        label: "Install Python dependencies"

tags:
  - finance
  - industry-analysis
  - industry-chain
  - A-share
  - fundamental-analysis
  - pywencai
  - iwencai
---

# A股行业六维一体深度分析引擎

## 技能概述

本技能包提供完整的行业深度分析能力，整合六大核心维度：

1. **结构层** — 产业链上中下游拆解、核心公司识别（pywencai 实时数据）
2. **数据层** — 行业估值排名、财务指标、盈利数据、板块行情（问财 API）
3. **框架层** — 五模块产业链解读框架（顶层评估→驱动→本质→产业链→风险）
4. **研究层** — 券商研报搜索（机构评级、目标价、投资逻辑）
5. **资讯层** — 实时财经资讯（政策/技术/竞争/投融资动态）
6. **宏观框架层** — 全球宏观周期定位与行业映射

## 分析脚本

### 产业链分析脚本（`scripts/analyze_industry.py`）

基于 pywencai 实时获取产业链数据，支持：

```bash
# 标准分析
python3 scripts/analyze_industry.py "新能源汽车"

# 深度分析
python3 scripts/analyze_industry.py "人工智能" --depth detailed

# JSON 输出
python3 scripts/analyze_industry.py "半导体" --json

# 保存结果
python3 scripts/analyze_industry.py "光伏" --save

# 列出支持的热门行业
python3 scripts/analyze_industry.py --list
```

覆盖维度：
- 行业概览：概念股数量、市值分布、行业归属
- 产业链结构：上中下游环节拆解、核心公司
- 财务分析：营收、净利润增长、估值水平
- 风险提示：估值、政策、市场风险

### 行业数据查询 CLI（`scripts/industry-query-cli.py`）

通过问财 API 查询行业数据：

```bash
# 行业估值排名
python3 scripts/industry-query-cli.py --query "A股行业估值排名"

# 行业盈利数据
python3 scripts/industry-query-cli.py --query "银行业盈利数据"

# 板块行情
python3 scripts/industry-query-cli.py --query "新能源板块行情"
```

## 六维分析执行流程

### 阶段一：并行数据采集（4路并发）

**维度1: 结构层** — analyze_industry.py
- 产业链上中下游拆解
- 核心公司识别与市值分布
- PE/利润增长等财务指标

**维度2: 数据层** — industry-query-cli.py
- 行业估值排名
- 行业盈利数据
- 板块涨跌幅排名

**维度3: 研究层** — 问财研报搜索 API
- API: `POST https://openapi.iwencai.com/v1/comprehensive/search`
- Headers: `X-Claw-Skill-Id: report-search, X-Claw-Skill-Version: 2.0.0`
- Query: `"{行业名}行业研究报告"`

**维度4: 资讯层** — 问财经资讯搜索 API
- API: `POST https://openapi.iwencai.com/v1/comprehensive/search`
- Headers: `X-Claw-Skill-Id: news-search, X-Claw-Skill-Version: 1.0.0`

### 阶段二：五模块框架分析

使用产业链解读框架整合数据：

1. **行业整体评估与投资价值定调** — 五维度雷达评分
2. **核心驱动与长期确信** — 底层逻辑拆解，结合政策资讯验证
3. **产业本质与商业模式** — 传导路径与边界
4. **产业链全链路拆解与咽喉节点** — 结合 analyze_industry 结果
5. **宏观周期与行业映射** — 结合全球宏观框架
6. **核心风险与长期基本面跟踪** — 实时资讯+宏观风险预警

### 阶段三：图表生成

- **雷达图** — 行业五维评估（天花板/护城河/生命周期/竞争格局/政策顺风）
- **柱状图** — 行业估值排名对比
- **饼图** — 产业链各环节占比
- **桑基图** — 产业链上下游流转

### 阶段四：报告输出

1. 行业画像（含五维雷达图+最新动态摘要）
2. 行业估值排名（含柱状图）
3. 投研观点摘要（券商研报汇总）
4. 行业实时资讯
5. 产业链深度解读（含桑基图/饼图）
6. 宏观周期评估
7. 风险与建议

## 参考文档

| 文件 | 说明 |
|------|------|
| `references/industry-chain-framework.md` | 产业链解读五模块框架（V3.0） |
| `references/analysis-framework.md` | 详细分析方法论与双轨制产业链分析 |
| `references/output-template.md` | 标准化报告输出模板 |
| `references/data-sources.md` | 可靠数据源参考 |
| `references/global-macro.md` | 全球宏观周期分析框架 |
| `references/chart-specs.md` | 图表可视化规范 |

## 数据模型

`models/industry_models.py` 提供 Pydantic 数据模型：
- `IndustryChainNode` — 产业链节点
- `IndustryChainAnalysis` — 产业链分析结果
- `IndustryOverview` — 行业概览
- `StockInIndustry` — 行业内个股
- `IndustryAnalysisResult` — 完整分析结果

## 环境变量

| 变量 | 必填 | 说明 | 获取方式 |
|------|------|------|---------|
| `IWENCAI_API_KEY` | 是 | 同花顺问财API密钥 | https://www.iwencai.com/skillhub |

## Python 依赖

```
pywencai>=0.12.0
pandas>=2.0.0
pydantic>=2.0.0
```

## 数据来源标注

- 产业链数据标注「数据来源于同花顺i问财（pywencai）」
- 行业估值/财务数据标注「数据来源于同花顺问财」
- 研报数据标注来源机构
- 资讯数据标注「数据来源于同花顺问财」

## 注意事项

1. analyze_industry.py 依赖 pywencai 库，需单独安装
2. 行业分析需结合宏观周期阶段，不同周期下同一行业投资逻辑可能截然不同
3. 资讯层建议至少查询行业动态+政策两条，覆盖基本面和技术面
4. 分析结果仅供参考，不构成投资建议
