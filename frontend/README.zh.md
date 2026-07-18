**English**: [README.md](./README.md)

# KWorks Electron Renderer

KWorks 的 Electron 渲染器 —— 基于 Next.js 16 与 React 19 构建、流式优先的现代界面，只通过 [`desktop/`](../desktop/) Electron 外壳启动，并通过 HTTP 与 Server-Sent Events 直连 Electron 管理的 [QiongQi 运行时](../qiongqi/)。

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
| 环境校验     | [@t3-oss/env-nextjs](https://env.t3.gg/) + [Zod](https://zod.dev/)                            |
| 单元测试     | [Vitest 4](https://vitest.dev/) + [happy-dom](https://github.com/capricorn86/happy-dom)       |
| Lint / 格式化 | [ESLint 9](https://eslint.org/) + [Prettier 3](https://prettier.io/) + [typescript-eslint](https://typescript-eslint.io/) |

## 快速开始

### 前置条件

- Node.js 22+
- pnpm 10.26.2+
- 已安装 [`../desktop`](../desktop/) 依赖

### 安装

```bash
pnpm install
```

此包不再作为独立 Web 应用启动。`pnpm dev`、`pnpm start`、`pnpm preview` 和 `pnpm build` 会主动失败并提示使用桌面端入口。开发和运行都应从 `desktop/` 包启动。

### 开发

```bash
pnpm -C ../desktop dev
```

### 构建与测试

```bash
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm lint:fix       # eslint --fix
pnpm format         # prettier --check .
pnpm format:write   # prettier --write .
pnpm test           # vitest run (单元测试)
pnpm build:desktop  # 内部命令：为 desktop build:app 生成静态导出到 ../frontend/out
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
├── typings/                # 环境类型声明
└── env.js                  # @t3-oss/env-nextjs schema
```

## 环境变量

构建期通过 `src/env.js` 校验。需要暴露给客户端的变量请加 `NEXT_PUBLIC_` 前缀。

| 变量名                                | 作用域 | 用途                                                              |
| ------------------------------------- | ------ | ----------------------------------------------------------------- |
| `GITHUB_OAUTH_TOKEN`                  | server | 可选的 GitHub OAuth token。                                       |
| `SKIP_ENV_VALIDATION`                 | build  | 跳过 Zod 校验（Docker 构建时有用）。                              |
| `DESKTOP_BUILD`                       | build  | `true` / `1` 切换为 Electron 打包使用的 `output: "export"`。      |

## 桌面端静态导出

`pnpm build:desktop`（由桌面端 `build:app` 流程调用）会设置 `DESKTOP_BUILD=true`，从而：

- 将 Next.js 切换为 [`output: "export"`](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)，产出 `out/`
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
```

单元测试位于 `tests/unit/`，镜像 `src/` 目录结构。渲染器集成验证必须通过 Electron 桌面壳启动。

## 贡献

新增 Agent 功能时：

1. 遵循既定目录布局（逻辑放 `core/<domain>/`，UI 放 `components/<area>/`）。
2. 数据跨边界处补充完整的 TypeScript 类型与 Zod schema。
3. 流式路径实现完善的错误处理。
4. 在 `tests/unit/` 下补充单元测试；需要渲染器集成覆盖时通过桌面端包添加。
5. 推送前运行 `pnpm lint && pnpm typecheck && pnpm test`。

Agent 架构深入说明见 [`AGENTS.md`](./AGENTS.md)，仓库级约定见根目录 [`CONTRIBUTING.zh.md`](../CONTRIBUTING.zh.md)。

## 许可证

MIT —— 详见 [LICENSE](../LICENSE)。
