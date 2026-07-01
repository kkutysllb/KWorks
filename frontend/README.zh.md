**English**: [README.md](./README.md)

# KWorks 前端

KWorks 的网页 UI —— 基于 Next.js 16 与 React 19 构建、流式优先的现代界面，通过 HTTP 与 Server-Sent Events 与 [QiongQi 运行时](../qiongqi/) 通信。

## 技术栈

| 分层         | 选型                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------- |
| 框架         | [Next.js 16](https://nextjs.org/) + [App Router](https://nextjs.org/docs/app) + Turbopack    |
| UI 库        | [React 19](https://react.dev/)                                                                |
| 样式         | [Tailwind CSS 4](https://tailwindcss.com/) + [tw-animate-css](https://github.com/romboHQ/tw-animate-css) |
| 组件体系     | [Shadcn UI](https://ui.shadcn.com/)、[MagicUI](https://magicui.design/)、[React Bits](https://reactbits.dev/) + [Radix 原语](https://www.radix-ui.com/) |
| 图标         | [lucide-react](https://lucide.dev/)                                                           |
| 状态 / 数据  | [TanStack Query 5](https://tanstack.com/query/latest)                                         |
| AI 原语      | [Vercel AI SDK](https://sdk.vercel.ai/) + [@langchain/core](https://js.langchain.com/)        |
| 流式 Markdown | [streamdown](https://github.com/nichenqin/streamdown) + [Shiki](https://shiki.style/) + [KaTeX](https://katex.org/) + [rehype/remark](https://github.com/remarkjs) 生态 |
| 代码编辑器   | [CodeMirror 6](https://codemirror.net/)（`@uiw/react-codemirror` + 语言包 + 主题）            |
| 终端         | [xterm.js](https://xtermjs.org/)（`@xterm/xterm` + `@xterm/addon-fit`）                       |
| 流程画布     | [xyflow](https://xyflow.com/)（`@xyflow/react`）                                              |
| 图表         | [Recharts](https://recharts.org/)                                                             |
| 动画         | [GSAP](https://gsap.com/) + [Motion](https://motion.dev/)                                     |
| 文档站点     | [Nextra 4](https://nextra.site/)（`nextra-theme-docs`）—— 桌面静态导出时禁用                  |
| 环境校验     | [@t3-oss/env-nextjs](https://env.t3.gg/) + [Zod](https://zod.dev/)                            |
| 单元测试     | [Vitest 4](https://vitest.dev/) + [happy-dom](https://github.com/capricorn86/happy-dom)       |
| E2E 测试     | [Playwright](https://playwright.dev/)                                                         |
| Lint / 格式化 | [ESLint 9](https://eslint.org/) + [Prettier 3](https://prettier.io/) + [typescript-eslint](https://typescript-eslint.io/) |

## 快速开始

### 前置条件

- Node.js 22+
- pnpm 10.26.2+
- 正在运行的 QiongQi 网关（完整本地栈请见[根目录 README](../README.zh.md)）

### 安装

```bash
pnpm install
```

开发服务器从 `NEXT_PUBLIC_BACKEND_BASE_URL` 读取网关地址。若未设置，`next.config.js` 会将 `/api/*`、`/v1/*`、`/health` 重写到 `http://127.0.0.1:9193`（可通过 `KWorks_INTERNAL_GATEWAY_BASE_URL` 覆盖）。因此通常只需在仓库根执行 `./start.sh start` 启动网关，再单独启动前端即可。

### 开发

```bash
pnpm dev            # http://localhost:9192 (Turbopack)
pnpm dev:fresh      # 清除 .next/ 后重启
```

### 构建与测试

```bash
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm lint:fix       # eslint --fix
pnpm format         # prettier --check .
pnpm format:write   # prettier --write .
pnpm test           # vitest run (单元测试)
pnpm test:e2e       # playwright test (针对 Chromium 的 E2E)
pnpm build          # next build (网页)
pnpm build:desktop  # 以 DESKTOP_BUILD=true 执行 next build → 静态导出到 ../frontend/out
pnpm start          # next start (生产服务器)
pnpm preview        # next build && next start
```

## 站点地图

```
/                         # 落地页 / 登录
/(auth)/*                 # 认证路由组
/workspace                # 已登录的工作区外壳
/workspace/chats          # 对话列表
/workspace/chats/new      # 发起新对话
/workspace/chats/[id]     # 指定对话（流式 + 工具 + 产物）
```

工作区还承载技能画廊、MCP 浏览器、设置面板与产物查看器，登录后即可发现。

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # 认证路由组
│   ├── workspace/          # 已登录工作区页面
│   ├── layout.tsx          # 根布局
│   ├── page.tsx            # 落地页
│   └── global-error.tsx    # 全局错误边界
├── components/             # React 组件
│   ├── ui/                 # 可复用 Shadcn 风格基础组件
│   ├── workspace/          # 工作区专用面板（聊天、产物、工具）
│   ├── landing/            # 落地页 hero 与各区块
│   ├── ai-elements/        # AI 流式 UI 块（消息、工具调用、推理）
│   └── desktop/            # 桌面端专用集成组件
├── core/                   # 与框架无关的业务逻辑
│   ├── api/                # 类型化 API 客户端 + fetch 封装
│   ├── threads/            # 线程生命周期、SSE 回放、提交
│   ├── messages/           # 消息渲染管线
│   ├── models/             # 共享类型与 Zod schema
│   ├── skills/             # 技能目录与激活
│   ├── mcp/                # MCP 服务浏览
│   ├── memory/             # 跨会话记忆面板
│   ├── artifacts/          # 产物查看状态
│   ├── tasks/              # 后台任务追踪
│   ├── todos/              # Todo 列表集成
│   ├── agents/             # Agent 身份 / 预设
│   ├── auth/               # 会话与令牌处理
│   ├── settings/           # 用户设置存储
│   ├── settings-config/    # 设置 schema 与默认值
│   ├── i18n/               # 国际化（en / zh）
│   ├── rehype/             # 自定义 rehype 插件
│   ├── streamdown/         # 流式 markdown 渲染配置
│   ├── uploads/            # 附件上传
│   ├── notifications/      # Toast / 应用内通知
│   ├── channels/           # 事件通道复用
│   ├── crons/              # 定时任务描述
│   ├── projects/           # 项目 / 工作区元数据
│   ├── tools/              # 工具诊断与调用
│   ├── desktop/            # Electron 桥接（IPC 契约）
│   ├── workspace-runtime/  # 工作区本地运行时配置
│   ├── config/             # 应用级配置常量
│   └── utils/              # 纯工具函数
├── hooks/                  # 跨切面 React hooks
│   ├── use-mobile.ts       # 响应式断点检测
│   └── use-global-shortcuts.ts
├── lib/                    # 底层工具
│   ├── utils.ts            # cn() 与小工具
│   └── ime.ts              # 输入法辅助
├── styles/                 # 全局 CSS
├── content/                # 静态 markdown / MDX 内容
├── typings/                # 环境类型声明
├── env.js                  # @t3-oss/env-nextjs schema
└── mdx-components.tsx      # MDX 组件映射
```

## 环境变量

构建期通过 `src/env.js` 校验。需要暴露给客户端的变量请加 `NEXT_PUBLIC_` 前缀。

| 变量名                                | 作用域 | 用途                                                              |
| ------------------------------------- | ------ | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_BACKEND_BASE_URL`        | client | 网关绝对地址。设置后会禁用内置重写。                              |
| `NEXT_PUBLIC_RUNTIME_API_BASE_URL`    | client | 可选的 `/api/*` 运行时接口独立 base。                             |
| `NEXT_PUBLIC_STATIC_WEBSITE_ONLY`     | client | 纯静态部署的 opt-out 开关。                                       |
| `KWorks_INTERNAL_GATEWAY_BASE_URL`    | server | 重写目标地址（默认 `http://127.0.0.1:9193`）                     |
| `INTERNAL_GATEWAY_URL`                | server | 根目录 `serve.mjs` 编排器使用的别名。                             |
| `GITHUB_OAUTH_TOKEN`                  | server | 可选的 GitHub OAuth token。                                       |
| `SKIP_ENV_VALIDATION`                 | build  | 跳过 Zod 校验（Docker 构建时有用）。                              |
| `DESKTOP_BUILD`                       | build  | `true` / `1` 切换为 `output: "export"` 并禁用 Nextra。            |

## 桌面端静态导出

`pnpm build:desktop`（由桌面端 `build:app` 流程调用）会设置 `DESKTOP_BUILD=true`，从而：

- 将 Next.js 切换为 [`output: "export"`](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)，产出 `out/`
- 禁用 `i18n` 与 `rewrites`（两者与静态导出不兼容）
- 跳过 Nextra 包装（文档站点仅网页版提供）
- 将图片标记为不优化（Electron 通过 `app://` 协议提供）

产出的 `out/` 目录随后由 `electron-builder` 打包 —— 见 [`desktop/README.md`](../desktop/README.md)。

## 交互归属约定

以下归属规则保证流式状态可预测：

- **输入框 busy 状态** 位于 `src/app/workspace/chats/[thread_id]/page.tsx`。
- **提交前的上传状态与线程提交** 位于 `src/core/threads/hooks.ts`。
- **`usePoseStream`** 是被动的 store selector；全局 WebSocket 生命周期保留在根布局中。

新增流式界面时，请优先复用 `core/threads` 管线，而不是另起一条并行的 SSE 订阅。

## 测试

```bash
pnpm test           # Vitest 单元测试（tests/unit/，镜像 src/ 布局）
pnpm test:e2e       # Playwright E2E（tests/e2e/，Chromium，mock 后端）
```

单元测试位于 `tests/unit/`，镜像 `src/` 目录结构。E2E 测试位于 `tests/e2e/`，驱动 Chromium 访问 mock 后端以保证确定性。

## 贡献

新增 Agent 功能时：

1. 遵循既定目录布局（逻辑放 `core/<domain>/`，UI 放 `components/<area>/`）。
2. 数据跨边界处补充完整的 TypeScript 类型与 Zod schema。
3. 流式路径实现完善的错误处理。
4. 在 `tests/unit/` 下补充单元测试，在 `tests/e2e/` 下按需补充 E2E 覆盖。
5. 推送前运行 `pnpm lint && pnpm typecheck && pnpm test`。

Agent 架构深入说明见 [`AGENTS.md`](./AGENTS.md)，仓库级约定见根目录 [`CONTRIBUTING.zh.md`](../CONTRIBUTING.zh.md)。

## 许可证

MIT —— 详见 [LICENSE](../LICENSE)。
