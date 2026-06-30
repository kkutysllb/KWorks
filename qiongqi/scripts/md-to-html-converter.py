#!/usr/bin/env python3
"""
Markdown -> HTML converter
Usage: python3 convert.py <input.md> <output.html>
"""

import sys
import os

try:
    import markdown
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'markdown', '-q'])
    import markdown

from markdown.extensions.tables import TableExtension
from markdown.extensions.fenced_code import FencedCodeExtension

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

    return '\n'.join(rules)


def extract_title(md_text):
    """Extract first heading from markdown"""
    for line in md_text.split('\n'):
        line = line.strip()
        if line.startswith('#'):
            return line.lstrip('#').strip()
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
        'nl2br',
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
