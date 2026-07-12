---
name: kk-strategy-research
description: 量化策略研究公共技能包——策略设计/编码/回测/评估全链路，支持A股/港股/美股/加密货币多市场，内置3种经典策略模板（双均线/RSI/MACD），SignalEngine合约规范，config.json标准配置，策略评审标准，开箱即用。
version: 1.0.0
author: kk-quant
license: Apache-2.0
category: finance


package:
  type: python
  entry: scripts/cli.py
capabilities:
  - id: strategy-design
    description: "策略设计五问框架：数据/信号/仓位/回测/验证"
  - id: strategy-coding
    description: "SignalEngine 合约编码规范"
  - id: strategy-backtest
    description: "信号回测引擎：总收益/年化/夏普/最大回撤/胜率/交易次数"
  - id: strategy-evaluate
    description: "策略评审标准：硬性门控 + 评分规则 + 行动建议"
  - id: strategy-templates
    description: "3种经典策略模板：双均线/RSI/MACD"
  - id: strategy-validate
    description: "策略文件语法验证（AST检查）"

permissions:
  filesystem: true
  shell: true

requires:
  bins: ["python3"]
  packages: ["pandas", "numpy"]

inputs:
  - name: action
    type: string
    required: true
    description: "操作类型：demo(演示回测)/list(列出策略)/validate(验证策略文件)"

metadata:
  openclaw:
    emoji: "🧪"
    version: "1.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - strategy-research
      - backtest
      - quantitative-analysis
    requires:
      bins: ["python3"]
      packages: ["pandas", "numpy"]
    install:
      - id: pip-deps
        kind: pip
        package: "pandas numpy"
        python: python3
        label: "Install Python dependencies"

tags:
  - finance
  - strategy-research
  - backtest
  - quantitative-analysis
---

# kk-strategy-research — 量化策略研究技能包

## 概述

策略生成与优化的完整工作流：

| 阶段 | 说明 |
|------|------|
| 需求解析 | 提取标的代码/时间范围/策略逻辑 |
| 策略设计 | 数据/信号/仓位/回测/验证五问框架 |
| 策略编码 | SignalEngine 合约 → `signal_engine.py` |
| 语法检查 | AST 验证 |
| 回测执行 | 计算核心指标 |
| 结果评估 | 评审标准 + 行动建议 |

## CLI 使用

```bash
# 策略演示回测（模拟数据）
python3 scripts/cli.py demo --strategy dual_ma --short 5 --long 20
python3 scripts/cli.py demo --strategy rsi --period 14 --oversold 30 --overbought 70
python3 scripts/cli.py demo --strategy macd

# 列出可用策略
python3 scripts/cli.py list

# 验证策略文件语法
python3 scripts/cli.py validate --file signal_engine.py
```

## SignalEngine 合约

```python
class SignalEngine:
    def generate(self, data_map: Dict[str, pd.DataFrame]) -> Dict[str, pd.Series]:
        """
        Args: data_map: code -> DataFrame (open, high, low, close, volume)
        Returns: code -> signal Series, 值范围 [-1.0, 1.0]
        """
```

### 硬性约束

1. signal Series 的 index 必须与输入 DataFrame 的 index 完全对齐
2. 包含所有必要 import（numpy, pandas 等）
3. 不要硬编码日期或股票代码
4. 不要包含 `if __name__ == "__main__"` 块
5. 纯 pandas/numpy 实现
6. 信号值范围 `[-1.0, 1.0]`

## config.json 标准格式

```json
{
  "source": "auto",
  "codes": ["000001.SZ"],
  "start_date": "2016-03-18",
  "end_date": "2026-03-18",
  "interval": "1D",
  "initial_cash": 1000000,
  "commission": 0.001,
  "extra_fields": null,
  "optimizer": null,
  "engine": "daily"
}
```

### 市场检测

| 格式 | 市场 | source | extra_fields |
|------|------|--------|-------------|
| `XXXXXX.SZ/SH/BJ` | A股 | tushare | pe, pb, roe 等 |
| `XXXX.US` | 美股 | yfinance | - |
| `XXXX.HK` | 港股 | yfinance | - |
| `XXX-USDT` | 加密货币 | okx | - |

## 评审标准

### 硬性门控（任一失败 → 不通过）

1. metrics 非空
2. equity 曲线无 NaN
3. exit_code == 0
4. trade_count > 0

### 评分规则

- 成功回测 + 完整产物 + 至少1笔交易 → score ≥ 60 → **通过**
- 收益差/夏普低不扣至60以下（仅作优化建议）

### Bug 类别

| Bug | 扣分 |
|-----|------|
| 零交易 | -30 |
| 严重亏损 (< -20%) | -10 |
| 最大回撤大 (< -30%) | -5 |

## 内置策略模板

| 策略 | 类名 | 说明 |
|------|------|------|
| dual_ma | DualMASignal | 双均线交叉（短期/长期可配） |
| rsi | RSISignal | RSI 超买超卖 |
| macd | MACDSignal | MACD 金叉死叉 |

## Python 依赖

```bash
# 依赖已预装，无需执行 pip install
```

## 知识库

| 文件 | 内容 |
|------|------|
| `references/strategy-examples.md` | A股/美股/加密货币策略调用示例 |
| `scripts/templates/signal_engine_template.py` | SignalEngine 基类模板 |

## 注意事项

- 标的代码规范：A股6位+.SZ/.SH，美股大写+.US，加密货币 XXX-USDT
- A股数据支持 extra_fields（pe/pb/roe），其他市场不支持
- 手续费默认 0.1%（单边）
- 信号值必须在 [-1.0, 1.0] 范围内
- 策略结果仅供参考，不构成投资建议
