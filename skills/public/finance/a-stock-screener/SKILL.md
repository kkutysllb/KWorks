---
name: a-stock-screener
description: |
  A 股对话式选股助手 (Orchestrator Pattern) —— 用户用自然语言描述"想要什么样的股票"，
  本 skill 解析意图 → 选择策略 → 拉取数据 → 套用过滤 → 多因子打分 → 输出选股报告。
  内置 10 种经典选股策略（价值/高股息/成长/动量/技术突破/超跌反弹/涨停龙头/机构资金追踪/
  缠论背驰/多因子横截面），工作流五阶段编排，支持无网络 mock 模式离线运行。
  适用于 kk-stock-analysis / kk-factor-research / kk-selection-strategies / kk-data-fetch
  等 skill 的上层"选股入口"场景。
version: 1.0.0
author: kk-quant
license: MIT
category: finance
keywords: stock-screener, a-share, orchestrator, natural-language, selection, screening, factor

capabilities:
  - id: intent-parsing
    description: "自然语言 → 策略意图解析：识别策略类型、市值范围、行业、TopN 等参数"
  - id: strategy-registry
    description: "策略注册中心：内置 10 种选股策略，支持按关键词/参数动态匹配"
  - id: workflow-orchestration
    description: "5 阶段工作流编排：意图确认→数据获取→策略过滤→因子打分→报告生成"
  - id: data-adapter
    description: "数据适配层：封装 tushare/AKShare/iWencai 等数据源，提供统一 pandas DataFrame 接口"
  - id: multi-factor-ranking
    description: "多因子打分排序：Z-score 标准化 + 加权求和 + TopN"
  - id: report-generation
    description: "结构化报告输出：Markdown 表格 + 行业分布 + 风险提示"
  - id: mock-mode
    description: "无网络 mock 模式：生成伪 A 股数据用于离线测试与冒烟验证"
  - id: cli-entry
    description: "命令行入口：python -m scripts.cli --query '<自然语言>' --top 10"

permissions:
  network: true
  filesystem: true
  shell: true
  env:
    - TUSHARE_TOKEN

requires:
  bins: ["python3"]
  packages: ["pandas", "numpy"]

inputs:
  - name: query
    type: string
    required: true
    description: "用户的自然语言选股请求，如 '高股息低估蓝筹股' / '创业板成长股' / '涨停板龙头'"
  - name: top_n
    type: integer
    required: false
    description: "返回结果数量，默认 10"

tags:
  - finance
  - stock-screener
  - A-share
  - orchestrator
  - factor
  - selection


package:
  type: python
  entry: scripts/data_adapter.py
metadata:
  openclaw:
    emoji: "🧭"
    version: "1.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - stock-screener
      - A-share
      - orchestrator
      - factor
      - selection
    requires:
      bins: ["python3"]
      packages: ["pandas", "numpy"]
    install:
      - id: pip-deps
        kind: pip
        package: "pandas numpy"
        python: python3
---

# A 股选股助手 (a-stock-screener)

> 面向自然语言的 A 股选股入口 skill。用对话代替公式，把用户的"模糊偏好"翻译成结构化策略、过滤条件与多因子打分。

## 这是什么

`a-stock-screener` 是一个 **Orchestrator 模式** 的选股 skill：

- 用户输入自然语言（"帮我找 10 只低估值高分红的蓝筹"）
- 解析器把语言映射成结构化 `Intent(strategy, filters, top_n)`
- 工作流引擎按"**确认 → 拉数据 → 过滤 → 打分 → 出报告**"五阶段串起来
- 每阶段都可以替换：数据源可换 Tushare/AKShare/iWencai/Mock，策略可加可减，报告可换 Markdown/HTML

它**不是** Tushare 的薄封装，**也不是** 单一策略的因子库。它位于上层，是用户表达"我要选股"时的第一接触点。

## 什么时候用它

| 用户表达 | 适用 |
|---|---|
| "帮我找几只高股息的票" | ✅ 选股入口 |
| "最近有哪些涨停龙头？" | ✅ 选股入口 |
| "创业板里有没有低估的成长股？" | ✅ 选股入口 |
| "用多因子帮我横截面选 20 只" | ✅ 选股入口 |
| "分析一下 600519" | ❌ 走 kk-stock-analysis |
| "这只股票的财务三表" | ❌ 走 kk-financial-statement |
| "回测一下双均线策略" | ❌ 走 kk-strategy-research |

## 快速开始

```bash
# 1) 依赖已预装，跳过安装
# pip install -r requirements.txt  # 不需要！

# 2) 离线冒烟测试（无需 Tushare token）
python -m scripts.cli --query "高股息低估蓝筹股" --top 10 --mock

# 3) 真实数据运行（需设置 TUSHARE_TOKEN 环境变量）
export TUSHARE_TOKEN=your_token_here
python -m scripts.cli --query "创业板高成长" --top 20
```

也可以作为 Python 模块调用：

```python
from scripts.intent_parser import parse_intent
from scripts.workflow_engine import WorkflowEngine

intent = parse_intent("帮我挑 10 只低估值高分红的大盘股")
engine = WorkflowEngine(intent, mock=True)
report = engine.run()
print(report)
```

## 架构

```
自然语言 query
    ↓
IntentParser (scripts/intent_parser.py)
    ↓ Intent {strategy, filters, top_n}
StrategyRegistry (scripts/strategy_registry.py)
    ↓ 提供该策略的 filter_func / rank_func / metadata
WorkflowEngine (scripts/workflow_engine.py) 5 阶段
    ├─ 1. intent_confirm    确认/补全参数
    ├─ 2. data_fetch        DataAdapter 拉取 A 股池 + 财务/行情
    ├─ 3. apply_filters     策略硬性过滤
    ├─ 4. score_rank        多因子 Z-score 打分排序
    └─ 5. report            ReportGenerator 输出 Markdown
    ↓
Markdown 选股报告
```

## 内置 10 大策略

| ID | 名称 | 关键特征 | 关键词示例 |
|---|---|---|---|
| `value` | 价值投资 | 低 PE + 低 PB + 高 ROE | 价值、低估、便宜、蓝筹 |
| `dividend` | 高股息 | 股息率 ≥ 4% + 稳定分红 | 高股息、分红、红利 |
| `growth` | 成长股 | 营收/净利润增速 ≥ 20% | 成长、高增长、增速 |
| `momentum` | 动量突破 | 20 日动量 + 量比放大 | 动量、趋势、强势 |
| `breakout` | 技术突破 | 突破年线/箱体 + 缩量回踩 | 突破、平台、技术面 |
| `oversold` | 超跌反弹 | RSI<30 + 偏离均线 ≥ 15% | 超跌、反弹、抄底 |
| `limit_up_leader` | 涨停龙头 | 涨停 + 板块共振 + 龙头特征 | 涨停、龙头、打板 |
| `institutional` | 机构资金追踪 | 北向/主力净流入 + 机构调研 | 机构、主力、北向 |
| `chan_theory` | 缠论背驰 | 底背驰 + 一买信号 | 缠论、背驰、买点 |
| `multi_factor` | 多因子横截面 | 价值/动量/质量/波动/规模 5 因子加权 | 多因子、横截面、综合 |

详细参数与字段见 [`references/strategy-catalog.md`](references/strategy-catalog.md)。

## 数据流约定

- **统一格式**：`pandas.DataFrame`，每行一只股票，列包括 `code, name, industry, market_cap, pe, pb, roe, dividend_yield, ...`
- **缺值约定**：`NaN` 表示数据缺失；过滤阶段自动剔除 `pe/pb/roe` 为空的股票
- **行业代码**：使用申万二级行业分类（如 `801010`=农林牧渔）
- **股票代码**：6 位数字（`600519`），不包含交易所后缀

## 文件结构

```
a-stock-screener/
├── SKILL.md                  # 本文件
├── README.md                 # 用户文档
├── requirements.txt
├── references/
│   ├── intent-parser.md      # 自然语言 → 策略映射规则
│   ├── strategy-catalog.md   # 10 大策略详表
│   ├── workflow.md           # 5 阶段工作流定义
│   └── output-template.md    # 选股报告模板
├── scripts/
│   ├── __init__.py
│   ├── intent_parser.py      # 意图解析
│   ├── strategy_registry.py  # 策略注册
│   ├── workflow_engine.py    # 工作流引擎
│   ├── data_adapter.py       # 数据适配
│   ├── ranking.py            # 打分排序
│   ├── report_generator.py   # 报告生成
│   └── cli.py                # 命令行入口
├── tests/
│   ├── test_intent_parser.py
│   ├── test_strategy_registry.py
│   ├── test_ranking.py
│   └── test_workflow.py
└── examples/
    ├── demo_value.py
    ├── demo_momentum.py
    └── demo_multi_factor.py
```

## 与其他 skill 的关系

| Skill | 关系 |
|---|---|
| `kk-stock-analysis` | 下游：单只股票的深度分析（被选出来的 TopN 可送过去做深度分析） |
| `kk-factor-research` | 下游：因子 IC/IR 验证、回测（验证本 skill 用的因子是否有效） |
| `kk-strategy-research` | 下游：策略回测（验证本 skill 选股逻辑的实盘表现） |
| `kk-data-fetch` | 数据源：拉取行情/财务原始数据 |
| `kk-selection-strategies` | 互补：本 skill 提供"对话入口"，该 skill 提供更细的策略调参 |

## 设计原则

1. **离线可跑**：所有依赖均通过 `--mock` 模式可降级为伪数据，便于 CI 冒烟
2. **可插拔**：策略、过滤函数、打分函数均注册式接入，新增策略不需要改主流程
3. **结构化**：自然语言 → Intent（dict）→ 报告（Markdown），不藏中间状态
4. **无副作用**：单次 run 不写盘（除报告可选落盘），便于在 Agent 循环中安全调用
5. **明确失败**：参数不足或数据缺失时**返回错误而非猜测**，保护用户决策
