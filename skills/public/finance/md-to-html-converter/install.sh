#!/bin/bash
# md-to-html-converter 安装脚本
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON="${PYTHON:-python3}"

echo "=== md-to-html-converter 安装 ==="
echo ""

# 1. 检查 python3
echo "[1/4] 检查 Python3..."
if ! command -v "$PYTHON" &> /dev/null; then
    echo "错误: 未找到 python3，请先安装 Python 3.8+"
    exit 3
fi
echo "  Python: $($PYTHON --version)"

# 2. 安装依赖
echo ""
echo "[2/4] 安装 Python 依赖..."
$PYTHON -m pip install -q markdown 2>/dev/null && echo "  依赖安装完成" || echo "  依赖安装失败（请手动 pip install markdown）"

# 3. 检查环境变量
echo ""
echo "[3/4] 检查环境变量..."
echo "  无必需环境变量"

# 4. 验证脚本
echo ""
echo "[4/4] 验证转换脚本..."
CONVERTER="$SCRIPT_DIR/scripts/convert.py"
if [ -f "$CONVERTER" ]; then
    echo "  convert.py: 已就绪"
else
    echo "  警告: scripts/convert.py 不存在"
fi

echo ""
echo "=== 安装完成 ==="
