---
name: kk-hithink-futures
description: 问财期货期权数据查询——支持期货行情、期权波动率、产销数据、会员持仓、会员榜单、行权数据的自然语言查询，基于同花顺问财 OpenAPI，开箱即用的跨平台技能包。
version: 1.0.0
author: kk-quant
license: MIT
category: finance


package:
  type: python
  entry: scripts/cli.py
capabilities:
  - id: futures-quote
    description: "期货行情查询：价格、涨跌幅、成交量、持仓量等"
  - id: options-vol
    description: "期权波动率查询：隐含波动率、历史波动率"
  - id: production-sales
    description: "产销数据查询：库存、产量、销量"
  - id: member-holding
    description: "会员持仓查询：持仓量、持仓变化、会员排名"
  - id: exercise-data
    description: "行权数据查询：行权价、行权量、行权比率"

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
  - name: query
    type: string
    required: true
    description: "自然语言查询，如 '沪铜期货最新行情'、'50ETF期权隐含波动率'"

metadata:
  openclaw:
    emoji: "🔧"
    version: "1.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - futures
      - options
      - iwencai
    requires:
      bins: ["python3"]
      env: ["IWENCAI_API_KEY"]
    install:
      - id: pip-deps
        kind: pip
        package: ""
        python: python3
        label: "无第三方依赖"
      - id: setup-env
        kind: manual
        instructions: "请配置环境变量 IWENCAI_API_KEY（同花顺问财API密钥）"
        label: "Configure API key"

tags:
  - finance
  - futures
  - options
  - iwencai
---

# kk-hithink-futures — 问财期货期权查询技能包

## 概述

本技能包提供期货期权数据查询能力，通过同花顺问财 OpenAPI 实现自然语言查询，支持期货行情、期权波动率、产销数据、会员持仓、行权数据等多种查询类型。跨平台兼容，无第三方 Python 依赖。

## 使用方式

### CLI 查询

```bash
# 查询期货行情
python3 scripts/cli.py --query "沪铜期货最新行情"

# 查询期权波动率
python3 scripts/cli.py --query "50ETF期权隐含波动率"

# 查询会员持仓
python3 scripts/cli.py --query "螺纹钢期货会员持仓排名"

# 翻页查询
python3 scripts/cli.py --query "期货行情" --page 2 --limit 20

# 重试请求
python3 scripts/cli.py --query "沪铜期货最新行情" --call-type "retry"

# 指定超时
python3 scripts/cli.py --query "原油期货库存数据" --timeout 60
```

### CLI 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| --query | STRING | 是 | 查询字符串 |
| --page | STRING | 否 | 分页参数（默认: 1） |
| --limit | STRING | 否 | 每页条数（默认: 10） |
| --api-key | STRING | 否 | API 密钥（默认从环境变量读取） |
| --call-type | STRING | 否 | 调用类型 normal/retry（默认: normal） |
| --timeout | INT | 否 | 超时秒数（默认: 30） |

### Python 直接调用

```python
import sys
sys.path.insert(0, 'scripts')
from cli import query_futures

result = query_futures(
    query="沪铜期货最新行情",
    page="1", limit="10",
    api_key=None,  # 从环境变量读取
)
```

### HTTP 直接调用

```python
import os, json, secrets, urllib.request

url = "https://openapi.iwencai.com/v1/query2data"
api_key = os.environ["IWENCAI_API_KEY"]
trace_id = secrets.token_hex(32)

payload = {"query": "沪铜期货最新行情", "page": "1", "limit": "10",
           "is_cache": "1", "expand_index": "true"}
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
    "X-Claw-Call-Type": "normal",
    "X-Claw-Skill-Id": "hithink-futures-query",
    "X-Claw-Skill-Version": "1.0.0",
    "X-Claw-Plugin-Id": "none",
    "X-Claw-Plugin-Version": "none",
    "X-Claw-Trace-Id": trace_id,
}
req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
                            headers=headers, method="POST")
resp = urllib.request.urlopen(req, timeout=30)
result = json.loads(resp.read().decode("utf-8"))
```

## 查询类型与示例

| 查询类型 | 示例 |
|----------|------|
| 期货行情 | "沪铜期货最新行情"、"铁矿石期货涨跌幅" |
| 期权波动率 | "50ETF期权隐含波动率"、"沪深300期权波动率" |
| 产销数据 | "原油期货库存数据"、"螺纹钢产量" |
| 会员持仓 | "螺纹钢期货会员持仓排名"、"沪金期货前10大多头" |
| 行权数据 | "50ETF期权行权数据"、"沪深300ETF期权行权比率" |

## 空数据处理

如果查询无数据，建议：
1. 放宽查询条件后重试（`--call-type retry`）
2. 访问同花顺问财 web 端：https://www.iwencai.com/unifiedwap/chat

## 数据来源

数据来源于**同花顺问财**（https://www.iwencai.com/unifiedwap/chat）

## 注意事项

- 使用前需配置 `IWENCAI_API_KEY` 环境变量
- API Key 获取：https://www.iwencai.com/skillhub → 登录 → 复制 Key
- 默认返回 10 条数据，通过 `--page` 和 `--limit` 翻页
- 本技能包仅用于研究，不构成投资建议
