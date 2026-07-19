---
name: analysis-report
description: 统一分析报告格式，所有分析类任务必须同时生成 Markdown 报告和带图表可视化的 HTML 数据看板；图表通过 chart-visualization 技能生成在线图片
version: 2.0.0
author: kk-quant
license: MIT
category: report


package:
  type: knowledge-only
capabilities:
  - id: report-generation
    description: "结构化分析报告生成：执行摘要+数据概览+核心分析+风险提示+参考资料"
  - id: chart-embedding
    description: "图表嵌入：通过 chart-visualization 技能在报告中嵌入26种可视化图表"
  - id: dashboard-generation
    description: "HTML数据看板生成：将分析结果转为带在线图表的金融风格HTML看板"

permissions:
  filesystem: true
  shell: true

requires:
  bins: ["python3", "node"]

inputs:
  - name: analysis_type
    type: string
    required: false
    description: "分析类型，决定报告模板选择"

metadata:
  openclaw:
    emoji: "📋"
    version: "2.0.0"
    author: "kk-quant"
    category: "report"
    tags:
      - report
      - analysis
      - visualization
      - chart
      - dashboard
      - html
    requires:
      bins: ["python3", "node"]

tags:
  - report
  - analysis
  - visualization
  - chart
  - dashboard
  - html
---

# 分析报告格式规范

## 核心原则：双报告强制输出

**当用户请求完整分析、复盘、研究、回测或数据看板任务时，必须同时生成两份报告，缺一不可：**

1. **Markdown 结构化报告**（`.md` 文件）— 详细文字分析
2. **HTML 数据看板**（`.html` 文件）— 金融风格可视化看板，内嵌在线图表

两份报告必须基于同一组技能获取的数据生成，内容互补而非重复：MD 报告侧重深度文字分析，HTML 看板侧重数据可视化呈现。

---

## 第一部分：Markdown 报告（.md）

### 报告结构

所有分析结果必须包含以下五个部分，按顺序完整呈现：

#### 1. 执行摘要
- 一句话总结核心结论
- 综合评估方向（偏多/偏空/中性/观望）
- 风险等级评估（高/中/低）

#### 2. 数据概览
- 使用表格展示关键指标
- 包含当前值、环比变化、同比变化
- 数据来源标注清晰

#### 3. 核心分析
- 详细解读数据背后的含义
- 结合市场环境和行业趋势
- 指出异常点和关键信号

#### 4. 风险提示
- 列出可能影响结论的风险因素
- 数据局限性说明
- 历史表现不代表未来

#### 5. 参考资料
- 引用数据来源
- 相关新闻或公告
- 使用 `[citation:标题](URL)` 格式

### MD 报告模板

```markdown
# {分析对象} 分析报告
**生成时间**: {YYYY-MM-DD HH:mm} | **分析师**: 小s

---

## 1. 执行摘要

| 指标 | 数值 | 信号 |
|------|------|------|
| 总体评级 | ⭐⭐⭐☆☆ | 中性 |

**核心结论**: {一句话总结}

**综合评估**: {偏多/偏空/中性/观望}

---

## 2. 数据概览

| 指标 | 当前值 | 环比 | 同比 |
|------|--------|------|------|
| {指标1} | {值} | {变化} | {变化} |

---

## 3. 核心分析

{详细分析内容，每个论点注明数据来源技能}

---

## 4. 风险提示

⚠️ **风险因素**: {风险列表}

---

## 5. 参考资料

- [数据来源名称](URL)
```

---

## 第二部分：HTML 数据看板（.html）— 必须生成

### 强制要求

每次分析**必须**生成一个金融风格的 HTML 数据看板，内嵌通过 `chart-visualization` 技能生成的**在线图表图片**。这是硬性要求，不可省略。

### 图表生成流程（必须使用内置技能）

**绝对禁止自行编写任何图表生成脚本、绘图代码或前端可视化代码。** 图表只能通过 `chart-visualization` 技能的 `generate.js` 脚本生成。

#### Step 1 — 选择图表类型
根据数据特征，从以下 26 种图表中选择（详见 `chart-visualization/references/` 目录）：

| 场景 | 图表工具名 | 说明 |
|------|-----------|------|
| 趋势/走势 | `generate_line_chart` | 折线图，适合时间序列 |
| 对比/排名 | `generate_column_chart` / `generate_bar_chart` | 柱状图/条形图 |
| 占比/结构 | `generate_pie_chart` / `generate_treemap_chart` | 饼图/矩形树图 |
| 多维评估 | `generate_radar_chart` | 雷达图 |
| 分布/统计 | `generate_boxplot_chart` / `generate_histogram_chart` | 箱线图/直方图 |
| 相关性 | `generate_scatter_chart` | 散点图 |
| 流程/转化 | `generate_funnel_chart` / `generate_flow_diagram` | 漏斗图/流程图 |
| 表格数据 | `generate_spreadsheet` | 表格/交叉表 |
| 双轴对比 | `generate_dual_axes_chart` | 双轴图（如价格+成交量） |

#### Step 2 — 构造参数并调用生成脚本
读取对应的 `chart-visualization/references/generate_{type}.md` 了解参数格式，然后在 chart-visualization 技能包根目录下调用：

```bash
# 在 chart-visualization 技能包根目录下执行（运行时已自动设置工作目录）
node scripts/generate.js '{"tool":"generate_line_chart","args":{"data":[{"time":"2025-01","value":100},{"time":"2025-02","value":120}],"title":"营收趋势","axisXTitle":"月份","axisYTitle":"金额(亿)"}}'
```

脚本会输出一个**在线图片 URL**（如 `https://...png`）。

#### Step 3 — 将图片 URL 嵌入 HTML 看板
将返回的图片 URL 直接放入 HTML 的 `<img>` 标签中。

### HTML 数据看板模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{分析对象} 数据看板</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; background: #0f172a; color: #e2e8f0; }
    .dashboard { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .header { text-align: center; padding: 24px 0; border-bottom: 1px solid #1e293b; margin-bottom: 24px; }
    .header h1 { font-size: 28px; color: #f8fafc; }
    .header .meta { color: #94a3b8; font-size: 14px; margin-top: 8px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; }
    .kpi-card .label { color: #94a3b8; font-size: 13px; }
    .kpi-card .value { font-size: 28px; font-weight: 700; color: #f8fafc; margin-top: 4px; }
    .kpi-card .change { font-size: 13px; margin-top: 4px; }
    .change.up { color: #22c55e; }
    .change.down { color: #ef4444; }
    .chart-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(480px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .chart-card { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; }
    .chart-card h3 { color: #cbd5e1; font-size: 16px; margin-bottom: 12px; }
    .chart-card img { width: 100%; border-radius: 8px; }
    .section { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; margin-bottom: 16px; }
    .section h3 { color: #cbd5e1; margin-bottom: 12px; }
    .section p, .section li { color: #cbd5e1; line-height: 1.8; }
    .disclaimer { text-align: center; color: #64748b; font-size: 12px; padding: 16px 0; border-top: 1px solid #1e293b; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="dashboard">
    <div class="header">
      <h1>{分析对象} 数据看板</h1>
      <div class="meta">生成时间: {YYYY-MM-DD HH:mm} | 分析师: 小s</div>
    </div>

    <!-- KPI 卡片区 -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="label">{指标名1}</div>
        <div class="value">{值}</div>
        <div class="change {up|down}">{变化} {方向箭头}</div>
      </div>
      <!-- 更多 KPI 卡片... -->
    </div>

    <!-- 图表区：每个图表通过 chart-visualization 技能生成 -->
    <div class="chart-grid">
      <div class="chart-card">
        <h3>{图表标题1}</h3>
        <img src="{chart-visualization 返回的在线图片URL}" alt="{图表说明}">
      </div>
      <div class="chart-card">
        <h3>{图表标题2}</h3>
        <img src="{chart-visualization 返回的在线图片URL}" alt="{图表说明}">
      </div>
      <!-- 更多图表... -->
    </div>

    <!-- 分析摘要 -->
    <div class="section">
      <h3>核心分析</h3>
      <p>{分析内容摘要}</p>
    </div>

    <!-- 风险提示 -->
    <div class="section">
      <h3>风险提示</h3>
      <ul>
        <li>{风险1}</li>
        <li>{风险2}</li>
      </ul>
    </div>

    <div class="disclaimer">
      ⚠️ 以上分析基于公开数据与逻辑推演，不构成投资建议。市场存在不可预知的风险。
    </div>
  </div>
</body>
</html>
```

### 图表数量要求

- **至少 3 张图表**（趋势图 + 对比图 + 结构图/雷达图）
- 复杂分析应生成 4-6 张图表
- 每张图表都必须通过 `chart-visualization` 技能生成，获得在线 URL

---

## ⚠️ 绝对禁止事项

1. **禁止自行编写图表生成脚本** — 不要写 Python matplotlib、JavaScript D3/ECharts/Chart.js、Canvas 绘图等任何自行可视化代码
2. **禁止使用 `:::chart` 块语法** — 这是旧平台语法，KWorks 不支持
3. **禁止使用 mermaid 代码块** — 只用 `chart-visualization` 技能
4. **禁止省略 HTML 看板** — 完整分析任务必须生成 HTML 看板（轻量单指标查询除外，见工作模式短问快答规则）
5. **禁止编造图表数据** — 所有图表数据必须来自技能获取的真实数据
6. **图表只能通过 `chart-visualization/scripts/generate.js` 生成**

---

## 报告输出方式

### 文件保存路径

在 KWorks 桌面环境中，报告保存到用户工作目录下：

1. **MD 报告**: `{用户工作目录}/{分析对象}_分析报告.md`
2. **HTML 看板**: `{用户工作目录}/{分析对象}_数据看板.html`

使用 `write` 工具保存文件。

### 展示给用户

在聊天回复中告知用户两份报告的文件路径。

---

## 完成后自检清单

- [ ] MD 报告包含执行摘要、数据概览、核心分析、风险提示、参考资料五个部分？
- [ ] HTML 看板已生成且包含至少 3 张在线图表？
- [ ] 所有图表通过 `chart-visualization` 技能生成（非自行编写脚本）？
- [ ] 所有数据来自技能获取（非编造）？
- [ ] HTML 看板使用金融风格深色主题？
- [ ] 两份报告已保存为文件？

## 中文字体配置

`generate.js` 已内置中文字体配置（`fontFamily`），确保图表中的中文标题、轴标签、图例正确渲染。如果私有化部署的 GPT-Vis-SSR 服务仍然出现中文乱码（方块□□□），需在服务器系统上安装中文字体（如 `Noto Sans CJK`），或通过 `VIS_REQUEST_SERVER` 环境变量指向已安装中文字体的渲染服务。
