---
name: kk-common
description: kk_Skills 公共库——iWencai/Tushare 统一客户端与金融分析格式化工具集
version: 1.0.0
author: kk-quant
license: MIT
category: finance


package:
  type: knowledge-only
capabilities:
  - id: iwencai-client
    description: "同花顺问财 OpenAPI 统一封装：HMAC 签名 + Trace-Id + 翻页 + 统一错误处理"
  - id: tushare-client
    description: "Tushare Pro 全量接口封装：自动限速、环境变量密钥管理、股票/期货/ETF/宏观全覆盖"
  - id: formatters
    description: "金融分析格式化工具集：百分比/进度条/信号标记/趋势图标/评分条/Markdown表格/技术指标格式化"

permissions:
  network: true
  filesystem: false
  shell: false
  env:
    - TUSHARE_TOKEN
    - IWENCAI_API_KEY

requires:
  bins: ["python3"]
  env: ["TUSHARE_TOKEN", "IWENCAI_API_KEY"]

metadata:
  openclaw:
    emoji: "🧩"
    version: "1.0.0"
    author: "kk-quant"
    category: "library"
    tags:
      - library
      - common
      - tushare
      - iwencai
      - formatters
    requires:
      bins: ["python3"]
      env: ["TUSHARE_TOKEN", "IWENCAI_API_KEY"]

tags:
  - library
  - common
  - tushare
  - iwencai
  - formatters
---

# kk-common

kk_Skills 公共库。提供 iWencai / Tushare 统一客户端与金融分析格式化工具集，供股票类技能复用。

详见 [README.md](./README.md)。
