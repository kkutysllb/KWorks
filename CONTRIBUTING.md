# 贡献指南

感谢你关注 KWorks。本文档面向准备修改、调试或审查本仓库代码的贡献者，内容以当前仓库结构为准。

## 当前项目边界

KWorks 由三个主要工作区组成：

```text
KWorks/
├── frontend/   # Next.js + React 网页端
├── qiongqi/    # QiongQi TypeScript runtime、API gateway 与 Agent 引擎
├── desktop/    # Electron 桌面壳
├── scripts/    # 根目录服务编排脚本
├── skills/     # 随仓库提供的 Agent 技能
└── start.sh    # 本地 Node stack 启停入口
```

注意：`qiongqi/` 是当前唯一有效的 QiongQi 源码位置。旧文档或历史脚本中出现的 `third_party/qiongqi` 属于迁移遗留路径，不应用于新开发。

## 开发环境

建议使用：

- Node.js 22+
- pnpm 10+

本仓库目前没有根目录级别的 pnpm workspace，也不依赖 nginx 作为本地开发入口。请分别在需要修改的工作区安装依赖：

```bash
cd qiongqi && pnpm install
cd ../frontend && pnpm install
cd ../desktop && pnpm install
```

## 本地启动

完整本地栈由根目录的 `start.sh` 启动。首次启动前需要先构建 QiongQi：

```bash
cd qiongqi
pnpm run build
cd ..
./start.sh start
```

默认服务地址：

| 服务 | 默认地址 | 说明 |
| --- | --- | --- |
| Frontend | `http://127.0.0.1:9192` | Next.js 网页端 |
| Gateway | `http://127.0.0.1:9193` | QiongQi HTTP/SSE API |

常用服务命令：

```bash
./start.sh status
./start.sh logs
./start.sh restart
./start.sh stop
```

`start.sh` 会委托 `scripts/serve.mjs` 启动 gateway 与 frontend。模型相关配置优先从环境变量读取，例如 `QIONGQI_API_KEY`、`QIONGQI_BASE_URL`、`QIONGQI_MODEL`；也兼容部分 `DEEPSEEK_*` 变量。

## 单工作区开发

### Frontend

```bash
cd frontend
pnpm dev        # 本地开发
pnpm lint       # ESLint
pnpm typecheck  # TypeScript
pnpm test       # Vitest 单元测试
pnpm test:e2e   # Playwright E2E
pnpm build      # Next.js 构建
```

### QiongQi

```bash
cd qiongqi
pnpm run build
pnpm run typecheck
pnpm test
pnpm run test:fast
```

如果要验证 hybrid SQLite 存储路径：

```bash
cd qiongqi
pnpm run prepare:sqlite
pnpm run verify:sqlite
```

如果要验证 evented orchestrator 与 A2A 双实例链路：

```bash
cd qiongqi
pnpm run verify:evented-a2a
```

### Desktop

```bash
cd desktop
pnpm run dev
pnpm run lint
node --test tests/*.test.mjs
pnpm run build:app
```

桌面端打包会依赖 `frontend/` 的桌面构建产物、根目录 `qiongqi/` runtime、`skills/` 以及桌面图标资源。

## 推荐开发流程

1. 从最新主分支创建功能分支：

   ```bash
   git checkout -b feature/your-feature
   ```

2. 先阅读将要修改模块附近的测试与调用方，保持改动范围收敛。

3. 按影响范围运行检查：

   ```bash
   cd frontend && pnpm lint && pnpm typecheck && pnpm test
   cd qiongqi && pnpm run typecheck && pnpm test
   cd desktop && pnpm run lint && node --test tests/*.test.mjs
   ```

4. 提交前确认没有无关改动：

   ```bash
   git status --short
   git diff --check
   ```

5. 使用清晰的提交信息说明行为变化、测试结果和迁移影响。

## 代码与配置约定

- 不要向仓库提交真实 API key、token、用户数据目录或本地 `.env` 内容。
- 新的 QiongQi 引擎代码应放在 `qiongqi/` 对应 package 下，不要恢复 `third_party/qiongqi`。
- 前端用户配置入口应只暴露用户需要理解和控制的选项；引擎内置能力应优先在 runtime 层保留默认行为。
- 涉及用户数据、记忆、线程、任务或工作区隔离时，必须检查 owner/user/thread/workspace 作用域，避免跨用户或跨任务泄漏。
- 文档中的端口、命令和路径应优先引用当前脚本或 `package.json`，避免写入容易过期的测试数量等统计数字。

## 文档入口

- [README.md](./README.md) - 当前仓库概览与快速启动
- [frontend/README.md](./frontend/README.md) - 前端开发说明
- [qiongqi/README.zh.md](./qiongqi/README.zh.md) - QiongQi 引擎说明
- [Install.md](./Install.md) - 安装流程说明

## 许可证

向 KWorks 贡献代码，即表示你同意你的贡献将按照 [MIT 许可证](./LICENSE) 进行许可。
