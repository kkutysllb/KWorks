# kk-common

kk_Skills 公共库 — 消除各技能包间的重复代码。

## 模块

| 模块 | 说明 | 提取来源 |
|------|------|----------|
| `kk_common.iwencai_client` | 同花顺问财 OpenAPI 统一客户端 | `kk-market-analysis/cli.py`、`kk-hithink-futures/cli.py` |
| `kk_common.tushare_client` | Tushare Pro API 统一客户端 | `kk-market-analysis/analysis/tushare_client.py`、`kk-futures-analysis/analysis/tushare_client.py` |
| `kk_common.formatters` | 金融分析格式化工具集 | 各项目 `analyze_*.py` 中的格式化辅助函数 |

## 安装

```bash
# 开发模式安装（项目根目录执行）
pip install -e kk-common/

# 或安装所有技能包的公共依赖
pip install -e kk-common/[dev]
```

## 使用

```python
# 问财客户端
from kk_common import IwencaiClient
client = IwencaiClient(skill_name="hithink-market-query")
result = client.query("贵州茅台最新价格")

# Tushare 客户端
from kk_common import get_tushare_client
client = get_tushare_client()
df = client.daily(ts_code="600519.SH")

# 格式化工具
from kk_common import pct, bar, signal_cn, md_table
print(pct(3.5))          # "+3.50%"
print(signal_cn("buy"))  # "买入"
print(md_table(["指标", "值"], [["PE", "15.2"]]))
```

## 运行测试

```bash
cd kk-common
python -m pytest tests/ -v
```
