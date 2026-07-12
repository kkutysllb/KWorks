---
name: kk-cb-analysis
description: 可转债全链路分析技能包——筛选+分析+看板三引擎一体化。覆盖16大看板模块（强赎/下修/龙虎榜/配债安全垫/妖债监控等）、六维度深度分析（基本指标/正股联动/债底保护/时间价值/资金面/套利信号）、智能自然语言筛选。基于同花顺问财OpenAPI，Python3标准库零依赖。
version: 1.0.0
author: kk-quant
license: MIT
category: finance

capabilities:
  - id: cb-selector
    description: "智能筛选：自然语言查询全市场可转债"
  - id: cb-analyzer-single
    description: "单只深度分析：六维度评分（0-100分）"
  - id: cb-analyzer-compare
    description: "批量横向对比：多只可转债综合排名"
  - id: cb-dashboard
    description: "全景看板：16大模块市场监控"
  - id: cb-forced-redeem
    description: "强赎时间表：全状态监控（已公告/不强赎/倒计时）"
  - id: cb-downrev-count
    description: "下修天计数：下修进度跟踪"
  - id: cb-bond-cushion
    description: "配债安全垫：高含权率标的安全边际"
  - id: cb-monster-bond
    description: "妖债监控：异常投机标的预警"
  - id: cb-arbitrage
    description: "套利机会：转股折价套利扫描"

permissions:
  filesystem: true
  shell: true
  network: true

requires:
  bins: ["python3"]
  packages: []
  env: ["IWENCAI_API_KEY"]

inputs:
  - name: query
    description: "自然语言查询条件（如：转股溢价率低于10%的可转债）"
    required: false
  - name: bonds
    description: "可转债名称，多只用逗号分隔"
    required: false
  - name: module
    description: "看板模块名（forced-redeem/top10/arbitrage 等）"
    required: false

tags:
  - cb
  - convertible-bond
  - iwencai
  - 可转债
  - 问财


package:
  type: python
  entry: scripts/cli.py
metadata:
  openclaw:
    version: "1.0.0"
    emoji: "📈"
    author: "kk-quant"
    category: "finance"
    tags:
      - cb
      - convertible-bond
      - iwencai
      - 可转债
      - 问财

---

# kk-cb-analysis — 可转债全链路分析技能包

## 三引擎架构

| 引擎 | 定位 | 核心能力 |
|------|------|---------|
| selector | 筛选 | 自然语言查询全市场可转债 |
| analyzer | 分析 | 六维度深度分析 + 批量对比 |
| dashboard | 看板 | 16大模块市场全景监控 |

**典型工作流**：dashboard 看全景 → selector 筛标的 → analyzer 深度分析

## CLI 使用

```bash
# 引擎1: 智能筛选
python3 scripts/cli.py select --query "转股溢价率低于10%的可转债"
python3 scripts/cli.py select --query "AAA级可转债" --limit 20

# 引擎2: 多维度分析
python3 scripts/cli.py analyze --mode single --bonds "精达转债"
python3 scripts/cli.py analyze --mode compare --bonds "精达转债,立讯转债,天业转债"

# 引擎3: 全景看板
python3 scripts/cli.py dashboard
python3 scripts/cli.py dashboard --module forced-redeem
python3 scripts/cli.py dashboard --module top10
python3 scripts/cli.py dashboard --module arbitrage

# 列出所有模式
python3 scripts/cli.py list
```

## 环境变量

```bash
export IWENCAI_API_KEY="your-api-key"
```

获取方式：打开 https://www.iwencai.com/skillhub → 登录 → 点击 Skill → 复制 API Key

## Analyzer 六维度评分体系

| 维度 | 权重 | 关键指标 |
|------|------|---------|
| 基本指标 | 25% | 转股溢价率、到期收益率 |
| 正股联动 | 20% | PE/PB、正股涨跌幅 |
| 债底保护 | 20% | 信用评级、下修条款、到期赎回价 |
| 时间价值 | 10% | 剩余期限 |
| 资金面 | 15% | 成交额、换手率 |
| 套利信号 | 10% | 转股套利空间、双低值 |

### 投资建议

| 综合评分 | 建议 |
|---------|------|
| ≥ 80 | 强烈推荐 |
| 65-79 | 推荐 |
| 50-64 | 观望 |
| < 50 | 回避 |

## Dashboard 16大模块

| 模块 | 说明 | CLI模式名 |
|------|------|----------|
| 强赎时间表 | 全状态监控 | forced-redeem |
| 下修天计数 | 下修进度跟踪 | downrev-count |
| 最小流通规模 | 小盘债 TOP10 | small-scale |
| 正股涨跌停 | 极端行情 | limit-stock |
| 龙虎榜 | 资金动向 | dragon-tiger |
| 发行进度 | 打新跟踪 | issuance |
| TOP10排行榜 | 多维度排名 | top10 |
| 配债安全垫 | 安全边际 | bond-cushion |
| 配债填权 | 填权机会 | rights-recovery |
| 时间期权价值 | 衰减分析 | time-option |
| 刚兑标的 | 纯债保本 | hard-redeem |
| 到期赎回价对比 | 到期收益 | maturity-price |
| 溢价率分析 | 分布统计 | premium-analysis |
| 网格交易标的 | 策略适配 | grid-trading |
| 妖债监控 | 异常预警 | monster-bond |
| 套利机会 | 折价套利 | arbitrage |

## API 调用规范

所有请求遵循问财网关 X-Claw-* Header 规范：

| Header | 说明 |
|--------|------|
| Authorization | Bearer <API Key> |
| X-Claw-Skill-Id | kk-cb-analysis |
| X-Claw-Trace-Id | 64字符唯一ID |
| X-Claw-Call-Type | normal / retry |

## 数据来源

- **同花顺问财**（https://www.iwencai.com/unifiedwap/chat）
- **集思录**（https://www.jisilu.cn）— 下修数据参考

## 依赖

Python 3 标准库，零第三方依赖。

## 注意事项

- 所有数据来源于同花顺问财，引用时必须标注
- API Key 必须通过环境变量或 --api-key 参数传入
- 空数据最多重试2次（自动简化查询条件）
- 策略结果仅供参考，不构成投资建议
