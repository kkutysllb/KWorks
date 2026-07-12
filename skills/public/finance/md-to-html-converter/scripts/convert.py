#!/usr/bin/env python3
"""
Markdown -> HTML converter
Usage: python3 convert.py <input.md> <output.html>
"""

import sys
import os
import re

try:
    import markdown
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'markdown', '-q'])
    import markdown

from markdown.extensions.tables import TableExtension
from markdown.extensions.fenced_code import FencedCodeExtension
from markdown.extensions.codehilite import CodeHiliteExtension

# ==================== Theme Config ====================
THEME = {
    'primary': '#1a73e8',
    'text': '#3c3c3c',
    'bg': '#ffffff',
    'border': '#e8e8e8',
    'code_bg': '#f6f8fa',
    'quote_bg': '#f8f9fa',
    'max_width': '780px',
    'font': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
}


def get_pygments_css():
    """Generate Pygments syntax highlighting CSS (GitHub Light theme)"""
    return '''
/* ===== Pygments Code Highlighting - GitHub Light Theme ===== */
.highlight {
    background: #f6f8fa;
    border-radius: 8px;
    padding: 16px 20px;
    overflow-x: auto;
    margin: 16px 0;
    border: 1px solid #e8e8e8;
}
.highlight pre {
    background: transparent !important;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    border-radius: 0 !important;
}
.highlight code {
    background: none !important;
    padding: 0 !important;
    font-size: 14px;
    line-height: 1.6;
    font-family: Consolas, Monaco, "Courier New", monospace;
}
/* Syntax colors */
.highlight .hll { background-color: #f8f8ff; }
.highlight .c { color: #6a737d; font-style: italic; }  /* Comment */
.highlight .k { color: #d73a49; font-weight: bold; }  /* Keyword */
.highlight .o { color: #24292e; }  /* Operator */
.highlight .cm { color: #6a737d; font-style: italic; }  /* Comment.Multiline */
.highlight .cp { color: #d73a49; font-weight: bold; }  /* Comment.Preproc */
.highlight .c1 { color: #6a737d; font-style: italic; }  /* Comment.Single */
.highlight .cs { color: #6a737d; font-style: italic; }  /* Comment.Special */
.highlight .gd { color: #b31d28; background-color: #ffeef0; }  /* Generic.Deleted */
.highlight .ge { font-style: italic; }  /* Generic.Emph */
.highlight .gr { color: #b31d28; }  /* Generic.Error */
.highlight .gh { color: #005cc5; font-weight: bold; }  /* Generic.Heading */
.highlight .gi { color: #22863a; background-color: #f0fff4; }  /* Generic.Inserted */
.highlight .go { color: #24292e; }  /* Generic.Output */
.highlight .gp { color: #e36209; font-weight: bold; }  /* Generic.Prompt */
.highlight .gs { font-weight: bold; }  /* Generic.Strong */
.highlight .gu { color: #6a737d; }  /* Generic.Subheading */
.highlight .gt { color: #b31d28; }  /* Generic.Traceback */
.highlight .kc { color: #005cc5; font-weight: bold; }  /* Keyword.Constant */
.highlight .kd { color: #d73a49; font-weight: bold; }  /* Keyword.Declaration */
.highlight .kn { color: #d73a49; font-weight: bold; }  /* Keyword.Namespace */
.highlight .kp { color: #d73a49; }  /* Keyword.Pseudo */
.highlight .kr { color: #d73a49; font-weight: bold; }  /* Keyword.Reserved */
.highlight .kt { color: #d73a49; font-weight: bold; }  /* Keyword.Type */
.highlight .m { color: #005cc5; }  /* Literal.Number */
.highlight .s { color: #032f62; }  /* Literal.String */
.highlight .na { color: #e36209; }  /* Name.Attribute */
.highlight .nb { color: #005cc5; }  /* Name.Builtin */
.highlight .nc { color: #6f42c1; font-weight: bold; }  /* Name.Class */
.highlight .no { color: #005cc5; }  /* Name.Constant */
.highlight .nd { color: #6f42c1; font-weight: bold; }  /* Name.Decorator */
.highlight .ni { color: #005cc5; }  /* Name.Entity */
.highlight .ne { color: #6f42c1; font-weight: bold; }  /* Name.Exception */
.highlight .nf { color: #6f42c1; }  /* Name.Function */
.highlight .nl { color: #005cc5; }  /* Name.Label */
.highlight .nn { color: #24292e; }  /* Name.Namespace */
.highlight .nt { color: #22863a; font-weight: bold; }  /* Name.Tag */
.highlight .nv { color: #e36209; }  /* Name.Variable */
.highlight .ow { color: #d73a49; font-weight: bold; }  /* Operator.Word */
.highlight .w { color: #24292e; }  /* Text.Whitespace */
.highlight .mb { color: #005cc5; }  /* Literal.Number.Bin */
.highlight .mf { color: #005cc5; }  /* Literal.Number.Float */
.highlight .mh { color: #005cc5; }  /* Literal.Number.Hex */
.highlight .mi { color: #005cc5; }  /* Literal.Number.Integer */
.highlight .mo { color: #005cc5; }  /* Literal.Number.Oct */
.highlight .sa { color: #032f62; }  /* Literal.String.Affix */
.highlight .sb { color: #032f62; }  /* Literal.String.Backtick */
.highlight .sc { color: #032f62; }  /* Literal.String.Char */
.highlight .dl { color: #032f62; }  /* Literal.String.Delimiter */
.highlight .sd { color: #032f62; }  /* Literal.String.Doc */
.highlight .s2 { color: #032f62; }  /* Literal.String.Double */
.highlight .se { color: #032f62; font-weight: bold; }  /* Literal.String.Escape */
.highlight .sh { color: #032f62; }  /* Literal.String.Heredoc */
.highlight .si { color: #032f62; }  /* Literal.String.Interpol */
.highlight .sx { color: #032f62; }  /* Literal.String.Other */
.highlight .sr { color: #032f62; }  /* Literal.String.Regex */
.highlight .s1 { color: #032f62; }  /* Literal.String.Single */
.highlight .ss { color: #032f62; }  /* Literal.String.Symbol */
.highlight .bp { color: #005cc5; }  /* Name.Builtin.Pseudo */
.highlight .fm { color: #6f42c1; }  /* Name.Function.Magic */
.highlight .vc { color: #e36209; }  /* Name.Variable.Class */
.highlight .vg { color: #e36209; }  /* Name.Variable.Global */
.highlight .vi { color: #e36209; }  /* Name.Variable.Instance */
.highlight .vm { color: #e36209; }  /* Name.Variable.Magic */
.highlight .il { color: #005cc5; }  /* Literal.Number.Integer.Long */
'''


def build_css():
    """Build complete CSS stylesheet"""
    T = THEME
    rules = []

    rules.append('* { margin:0; padding:0; box-sizing:border-box; }')
    rules.append('body {')
    rules.append('  font-family: ' + T['font'] + ';')
    rules.append('  max-width: ' + T['max_width'] + ';')
    rules.append('  margin: 0 auto; padding: 30px 20px;')
    rules.append('  color: ' + T['text'] + '; background: ' + T['bg'] + ';')
    rules.append('  line-height: 1.8; font-size: 16px;')
    rules.append('}')

    rules.append('h1 { font-size:28px; font-weight:bold; color:#1a1a1a; margin:30px 0 20px; line-height:1.4; text-align:center; border-bottom:3px solid ' + T['primary'] + '; padding-bottom:15px; }')
    rules.append('h2 { font-size:22px; color:' + T['primary'] + '; margin:35px 0 18px; padding-bottom:10px; border-bottom:2px solid ' + T['primary'] + '; line-height:1.5; }')
    rules.append('h3 { font-size:18px; color:#333; margin:25px 0 12px; line-height:1.6; }')
    rules.append('h4 { font-size:16px; color:#444; margin:20px 0 10px; }')

    rules.append('p { margin:12px 0; line-height:1.8; word-break:break-word; }')
    rules.append('a { color:' + T['primary'] + '; text-decoration:none; border-bottom:1px solid ' + T['primary'] + '; }')
    rules.append('a:hover { opacity:0.8; }')
    rules.append('strong { color:#1a1a1a; font-weight:700; }')

    rules.append('blockquote { background:' + T['quote_bg'] + '; border-left:4px solid ' + T['primary'] + '; padding:16px 20px; margin:20px 0; border-radius:4px; font-size:15px; }')
    rules.append('blockquote p { margin:6px 0; }')

    rules.append('table { width:100%; border-collapse:collapse; margin:20px 0; font-size:14px; overflow-x:auto; display:block; }')
    rules.append('th { background:' + T['primary'] + '; color:white; padding:12px 10px; text-align:left; font-weight:600; white-space:nowrap; }')
    rules.append('td { padding:10px; border-bottom:1px solid ' + T['border'] + '; vertical-align:top; }')
    rules.append('tr:nth-child(even) td { background:#f8f9fa; }')
    rules.append('tr:hover td { background:#f0f4f8; }')

    rules.append('code { background:#f0f0f0; color:#e83e8c; padding:2px 6px; border-radius:3px; font-family:Consolas,Monaco,"Courier New",monospace; font-size:0.9em; }')
    rules.append('pre { background:' + T['code_bg'] + '; border-radius:8px; padding:16px 20px; overflow-x:auto; margin:16px 0; border:1px solid ' + T['border'] + '; }')
    rules.append('pre code { background:none; color:' + T['text'] + '; padding:0; font-size:14px; line-height:1.6; }')

    rules.append('img { max-width:100%; height:auto; border-radius:8px; margin:10px auto; display:block; }')
    rules.append('ul, ol { margin:12px 0; padding-left:2em; }')
    rules.append('li { margin:4px 0; line-height:1.8; }')
    rules.append('hr { border:none; border-top:1px solid ' + T['border'] + '; margin:30px 0; }')
    rules.append('@media print { body { max-width:100%; padding:0; } table { page-break-inside:avoid; } }')

    # Append Pygments CSS
    rules.append(get_pygments_css())

    return '\n'.join(rules)


def extract_title(md_text):
    """Extract first heading from markdown"""
    for line in md_text.split('\n'):
        stripped = line.strip()
        # 标准 Markdown 标题：1-6 个 # 后跟空格 + 文本
        match = re.match(r'^#{1,6}\s+(.+)', stripped)
        if match:
            return match.group(1).strip()
    return 'Document'


def build_html(title, css, body):
    """Build complete HTML document"""
    doc = []
    doc.append('<!DOCTYPE html>')
    doc.append('<html lang="zh-CN">')
    doc.append('<head>')
    doc.append('<meta charset="UTF-8">')
    doc.append('<meta name="viewport" content="width=device-width, initial-scale=1.0">')
    doc.append('<title>' + title + '</title>')
    doc.append('<style>')
    doc.append(css)
    doc.append('</style>')
    doc.append('</head>')
    doc.append('<body>')
    doc.append(body)
    doc.append('</body>')
    doc.append('</html>')
    return '\n'.join(doc)


def convert(md_file, html_file):
    """Convert Markdown file to styled HTML file"""
    with open(md_file, 'r', encoding='utf-8') as f:
        md_text = f.read()

    title = extract_title(md_text)

    extensions = [
        TableExtension(),
        FencedCodeExtension(),
        CodeHiliteExtension(css_class='highlight', guess_lang=False, linenums=False),
        'attr_list',
    ]
    html_body = markdown.markdown(md_text, extensions=extensions)

    css = build_css()
    html_full = build_html(title, css, html_body)

    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html_full)

    print("OK - Conversion done!")
    print("  Input:  " + md_file)
    print("  Output: " + html_file)
    print("  Title:  " + title)
    print("  Size:   " + str(os.path.getsize(html_file)) + " bytes")
    print("  Highlight: Pygments (GitHub Light theme)")


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 convert.py <input.md> <output.html>")
        sys.exit(1)

    md_file = sys.argv[1]
    html_file = sys.argv[2]

    if not os.path.exists(md_file):
        print("Error: File not found: " + md_file)
        sys.exit(1)

    convert(md_file, html_file)
