---
name: kk-factor-research
description: 量化因子研究公共技能包——整合因子方法论、IC/IR分析引擎、分层回测、基本面筛选、多因子选股和小盘成长股挖掘，覆盖因子定义→有效性检验→组合构建→选股应用全链路，开箱即用的跨平台技能包。
version: 1.0.0
author: kk-quant
license: Apache-2.0
category: finance


package:
  type: python
  entry: scripts/cli.py
capabilities:
  - id: factor-analysis
    description: "IC/IR 统计分析 + 分层回测，检验单因子有效性"
  - id: factor-combination
    description: "多因子组合：等权/IC加权/Schmidt正交化"
  - id: fundamental-filter
    description: "基本面因子筛选：PE/PB/ROE 多条件过滤"
  - id: multifactor-screening
    description: "六因子选股框架：价值/动量/质量/低波动/规模/成长"
  - id: small-cap-growth
    description: "小盘成长股挖掘：20-200亿市值高成长公司筛选"
  - id: factor-timing
    description: "因子择时：经济周期映射 + 因子拥挤度评估"

permissions:
  network: false
  filesystem: true
  shell: true

requires:
  bins: ["python3"]
  packages: ["pandas", "numpy", "scipy"]

inputs:
  - name: action
    type: string
    required: true
    description: "操作类型：analyze(IC/IR分析)/filter(基本面筛选)"

metadata:
  openclaw:
    emoji: "🔬"
    version: "1.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - factor-research
      - quantitative-analysis
      - A-share
    requires:
      bins: ["python3"]
      packages: ["pandas", "numpy", "scipy"]
    install:
      - id: pip-deps
        kind: pip
        package: "pandas numpy scipy"
        python: python3
        label: "Install Python dependencies"

tags:
  - finance
  - factor-research
  - quantitative-analysis
  - A-share
---

# kk-factor-research — 量化因子研究技能包

## 概述

本技能包整合四大因子研究能力，覆盖因子定义→有效性检验→组合构建→选股应用全链路：

| 能力模块 | 来源 | 功能 |
|---------|------|------|
| **因子研究框架** | factor-research | IC/IR 分析、分层回测、因子组合 |
| **基本面因子筛选** | fundamental-filter | PE/PB/ROE 多条件价值/成长筛选 |
| **量化因子选股** | 量化因子选股 | 六因子模型 + 因子择时 + 拥挤度 |
| **小盘成长股挖掘** | 小盘成长股挖掘 | 小市值高成长公司筛选 + 专精特新 |

## 使用方式

### CLI — 因子有效性分析

```bash
# IC/IR 分析 + 分层回测
python3 scripts/cli.py analyze \
  --factor-csv factor.csv \
  --return-csv return.csv \
  --output-dir ./output \
  --n-groups 5
```

输入 CSV 格式：`index=日期`, `columns=股票代码`

### CLI — 基本面因子筛选

```bash
# 输出筛选参数
python3 scripts/cli.py filter \
  --codes 000001.SZ,600036.SH,000858.SZ \
  --pe-max 20 --pb-max 3 --roe-min 8
```

### Python — 因子引擎直接调用

```python
import sys
sys.path.insert(0, 'scripts/analysis')
from factor_engine import compute_ic_series, ic_summary, quantile_backtest

ic_df = compute_ic_series(factor_df, return_df)
summary = ic_summary(ic_df)
bt = quantile_backtest(factor_df, return_df, n_groups=5)
```

### Python — 多因子组合

```python
from factor_engine import factor_combination

# 等权组合
composite = factor_combination([value_f, momentum_f, quality_f], method='equal_weight')

# IC 加权
composite = factor_combination([value_f, momentum_f], method='ic_weight')

# 正交化
composite = factor_combination([value_f, momentum_f], method='orthogonal')
```

## IC/IR 判断标准

| 指标 | 阈值 | 含义 |
|------|------|------|
| IC 均值 | > 0.03 | 因子具有基本预测力 |
| IC 均值 | > 0.05 | 因子具有较强预测力 |
| IC 均值 | > 0.10 | 异常高，检查前视偏差 |
| IR | > 0.5 | 因子稳定有效 |
| IR | > 1.0 | 极强（非常罕见） |
| IC>0 占比 | > 55% | 方向稳定 |

## 六因子模型

| 因子 | 主要指标 | 学术基础 |
|------|---------|---------|
| 价值 | 盈利收益率、PB倒数、FCF收益率 | Fama-French HML |
| 动量 | 12-1月价格动量、盈利修正 | Carhart 四因子 |
| 质量 | ROE、盈利稳定性、低杠杆 | QMJ |
| 低波动 | 已实现波动率、Beta、下行偏差 | 低波动异象 |
| 规模 | 总市值 | Fama-French SMB |
| 成长 | 营收增速、利润增速、利润率扩张 | 成长溢价 |

## 因子择时框架

| 经济周期 | 利好因子 | 不利因子 |
|---------|---------|---------|
| 复苏初期 | 规模、动量、成长 | 低波动 |
| 扩张中期 | 动量、质量 | 价值 |
| 扩张末期 | 质量、价值 | 规模、成长 |
| 下行/衰退 | 低波动、质量 | 动量、规模 |
| 触底回升 | 价值、规模 | 低波动 |

## 知识库文件

| 文件 | 内容 |
|------|------|
| `references/factor-methodology.md` | 六因子详细定义、评分方法、择时框架、A股特殊性 |
| `references/small-cap-screening-criteria.md` | 小盘成长股筛选标准、质量评分模型、风险框架 |
| `references/multifactor-output-template.md` | 多因子选股报告模板 |
| `references/smallcap-output-template.md` | 小盘成长股报告模板 |

## Python 依赖

```bash
# 依赖已预装，无需执行 pip install
```

## 注意事项

- **前视偏差**: 因子值用 T 日数据，收益必须用 T+1 到 T+N 数据
- **行业中性**: 建议在申万一级行业内做 Z-score 标准化
- **去极值**: 在 2.5/97.5 百分位缩尾处理
- **幸存者偏差**: 回测应包含已退市股票
- **因子拥挤**: 定期检查因子 IC 时序衰减
- **分析结果仅供参考，不构成投资建议**
