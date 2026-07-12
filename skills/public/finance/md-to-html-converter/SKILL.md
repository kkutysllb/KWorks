---
name: md-to-html-converter
description: 将Markdown格式报告转换为精美的HTML文档，完整保留图文内容。支持表格、代码块、引用、图片、层级标题等所有Markdown元素的样式化输出。
version: 1.0.0
author: kk-quant
license: MIT
category: utility


package:
  type: python
  entry: scripts/convert.py
capabilities:
  - id: markdown-conversion
    description: "Markdown转HTML：解析所有标准Markdown元素，内联CSS样式，响应式布局"
  - id: image-preservation
    description: "图片保留：所有Markdown图片转为HTML img标签，保持原始URL"
  - id: mobile-adaptation
    description: "移动端适配：响应式布局，手机/平板/电脑均可浏览"

permissions:
  filesystem: true
  shell: true

requires:
  bins: ["python3"]
  packages: ["markdown"]

inputs:
  - name: input_file
    type: string
    required: true
    description: "输入Markdown文件路径"
  - name: output_file
    type: string
    required: true
    description: "输出HTML文件路径"

metadata:
  openclaw:
    emoji: "📄"
    version: "1.0.0"
    author: "kk-quant"
    category: "converter"
    tags:
      - converter
      - markdown
      - html
    requires:
      bins: ["python3"]
      packages: ["markdown"]
    install:
      - id: pip-deps
        kind: pip
        package: "markdown"
        python: python3
        label: "Install Python dependencies"

tags:
  - converter
  - markdown
  - html
---

# Markdown 转 HTML 文档转换器

## 核心功能

将任意 Markdown 报告转换为带精美样式的独立 HTML 文档，完整保留所有图文内容。

## 使用方式

运行 `scripts/convert.py` 脚本完成转换：

```bash
python3 /Users/libing/kk_Projects/kk_Stock/kk_QuantFlows/server/skills/md-to-html-converter/scripts/convert.py <输入.md> <输出.html>
```

### 脚本功能

1. **解析 Markdown**：使用 `markdown` 库解析所有标准 Markdown 元素
2. **提取并保留图片**：所有 `![alt](url)` 格式的图片转为 `<img>` 标签，保持原始 URL
3. **内联 CSS 样式**：输出独立的 HTML 文件，所有样式内联，无需外部依赖
4. **移动端适配**：响应式布局，手机/平板/电脑均可正常浏览

### 支持的 Markdown 元素

| 元素 | Markdown 语法 | HTML 输出 |
|------|-------------|----------|
| 标题 | `# ~ ####` | 带样式的 h1-h4 |
| 加粗 | `**text**` | 加粗 + 主题色 |
| 斜体 | `*text*` | 斜体 |
| 引用 | `> text` | 左侧彩色边线引用块 |
| 表格 | 竖线分隔 | 蓝色表头 + 斑马纹 |
| 代码块 | 三反引号 | 浅灰背景代码区 |
| 行内代码 | 单反引号 | 粉色高亮标签 |
| 图片 | `![alt](url)` | 响应式图片，居中显示 |
| 链接 | `[text](url)` | 蓝色可点击链接 |
| 列表 | `- item` | 带缩进的列表 |
| 水平线 | `---` | 灰色分隔线 |
| 段落 | 空行分隔 | 带行高的段落 |

### 输出 HTML 特性

- 独立文件，无外部依赖
- UTF-8 编码，中文友好
- 响应式布局（max-width: 780px）
- 打印友好（print 样式）
- 可直接在浏览器打开
- 全选复制后可粘贴到公众号编辑器

## 注意事项

- 图片使用原始 URL，需要网络才能加载
- 如果 Markdown 中图片使用本地路径，需确保路径正确
- 输出 HTML 可直接双击在浏览器中打开查看

## 自定义样式

如需调整主题色、字体等，修改 `scripts/convert.py` 中的 `THEME` 字典即可。
