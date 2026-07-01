**English**: [README.md](./README.md)

# KWorks 桌面端

将 KWorks 前端与 QiongQi 运行时打包为单一自包含桌面应用的 Electron 壳，支持 macOS、Windows 与 Linux。

> 桌面应用**完全自包含**：内置 QiongQi 运行时、共享技能库与前端静态产物。安装后无需额外的 Node 工具链或独立 Web 服务器即可运行。

## 核心特性

- **单一可双击应用** —— 内嵌运行时 + 技能 + 前端，运行期无外部依赖。
- **独立数据目录** —— 使用 `~/.kworks-workspace/`，与网页端的 `~/.kworks-workspace-web/` 完全隔离。
- **内嵌后端生命周期管理** —— 以子进程方式启动并监管 QiongQi 网关，轮询 `/health`，退出时优雅关闭。
- **自定义 `app://` 协议** —— 以 `secure: true`、`corsEnabled: true`、`supportFetchAPI: true` 提供前端静态产物，使浏览器级 API 在 Electron 内可用。
- **系统托盘 + 全局快捷键** —— `CmdOrCtrl+Shift+O` 切换窗口；关闭窗口时隐藏到托盘而非退出。
- **单实例锁** —— 再次启动会聚焦已有窗口，而非启动重复实例。
- **自动更新** —— `electron-updater` 检查发布并在下次启动时应用。
- **原生终端** —— `node-pty` 驱动应用内终端面板（权限通过 `postinstall` 自动修复）。
- **URL 安全策略** —— 仅白名单内的外部 URL 可在系统浏览器打开；所有导航均受沙箱约束。
- **多窗口** —— 每个工作区在独立 `BrowserWindow` 中打开，共享会话状态。

## 技术栈

| 关注点        | 选型                                                    |
| ------------- | ------------------------------------------------------- |
| 壳            | [Electron 33](https://www.electronjs.org/)              |
| 语言          | TypeScript 5（ESM，`ES2022` target）                    |
| 打包器        | [electron-builder 25](https://www.electronjs.org/docs/latest/tutorial/electron-builder) |
| 自动更新      | [electron-updater 6](https://github.com/electron-userland/electron-builder/tree/master/packages/electron-updater) |
| 原生终端      | [node-pty 1.1](https://github.com/microsoft/node-pty)   |
| 测试运行器    | Node 内置 [`node --test`](https://nodejs.org/api/test.html) |
| 模块格式      | ESM（`"type": "module"`），preload 编译为 `.cjs`        |

## 仓库结构

```
desktop/
├── src/
│   ├── main.ts                  # Electron 主进程入口（窗口、托盘、菜单、快捷键）
│   ├── backend.ts               # QiongQi 网关子进程生命周期
│   ├── qiongqi-launch-config.ts # 从环境变量或用户配置解析 model / baseUrl / apiKey / storage
│   ├── frontend-protocol.ts     # 解析前端 URL（dev server 还是 app:// 静态产物）
│   ├── ipc.ts                   # IPC 通道注册（主 ↔ 渲染）
│   ├── preload.ts               # 上下文隔离的 preload（编译为 dist/preload.cjs）
│   ├── paths.ts                 # 内嵌运行时、技能、日志、数据目录的路径解析
│   ├── migration.ts             # 首次启动时的一次性数据 / 技能迁移
│   ├── updater.ts               # electron-updater 接线
│   ├── shutdown.ts              # 带超时的后端优雅关闭
│   ├── logger.ts                # 共享 logger + 渲染进程日志转发
│   └── url-policy.ts            # 允许的来源 / 外部 URL 策略
├── scripts/
│   ├── dev.mjs                  # 开发启动器（编译 TS、启动 Electron + Vite dev）
│   ├── generate-icons.sh        # 从源 PNG 生成各平台图标
│   ├── fix-node-pty-permissions.mjs  # postinstall：修复原生二进制权限
│   └── verify-package-resources.mjs  # 打包前断言资源存在
├── tests/                       # 18 个 node:test 套件（生命周期、安全、打包...）
├── electron-builder.yml         # 打包配置（files、extraResources、目标产物）
├── tsconfig.json                # 主进程 TS 配置
├── tsconfig.preload.json        # preload TS 配置（CommonJS 输出）
└── package.json
```

## 快速开始

### 前置条件

- Node.js 22+
- pnpm 10+
- 仓库根的 frontend 与 qiongqi 工作区已安装并构建（见下文）
- 原生模块所需的平台工具链（`node-pty` 需要 C++ 编译器）

### 安装

```bash
cd desktop
pnpm install        # postinstall 会自动执行 fix-node-pty-permissions.mjs
```

### 开发模式

```bash
pnpm run dev
```

`scripts/dev.mjs` 会：

1. 将 `src/*.ts` 编译到 `dist/`（`preload.ts` 编译为 `dist/preload.cjs`）
2. 启动 Electron 主进程，主进程会：
   - 解析前端（当 `DEV_SERVER_URL` 可达时默认指向仓库根 `frontend/` dev server 的 9192 端口，否则回退到静态产物）
   - 从仓库根 `qiongqi/` 运行时启动 QiongQi 网关
3. 打开指向前端的 KWorks 窗口

### 打包发布

```bash
pnpm run build:app
```

这会运行完整流水线：

1. `pnpm run build` —— 编译主进程 + preload 的 TypeScript
2. `pnpm run build:frontend` —— 以 `DESKTOP_BUILD=true` 调用 `frontend/`，产出 `frontend/out/`
3. `pnpm run verify:package-resources` —— 断言运行时入口、技能、图标与前端产物均存在
4. `electron-builder` —— 在 `desktop/release/` 产出各平台安装包

目标产物（见 `electron-builder.yml`）：

| 平台    | 目标产物                    |
| ------- | --------------------------- |
| macOS   | `dmg`、`zip`                |
| Windows | `nsis`、`portable`          |
| Linux   | `AppImage`、`deb`           |

### 常用脚本

```bash
pnpm run build               # 仅编译 TS（主进程 + preload）
pnpm run build:icons         # 从 build/icon.png 重新生成各平台图标
pnpm run build:frontend      # 通过 desktop 构建产出 ../frontend/out
pnpm run verify:package-resources  # 打包前资源断言
pnpm run fix:node-pty-permissions  # 手动修复 node-pty 二进制权限
pnpm run lint                # 对主进程 + preload 执行 tsc --noEmit
```

## 配置

### 环境变量

| 变量名                         | 用途                                                                       |
| ------------------------------ | -------------------------------------------------------------------------- |
| `KWORKS_SKIP_BACKEND_AUTOLAUNCH` | 设为 `1` 可跳过内嵌网关的自动启动（调试壳时有用）。                        |
| `DEV_SERVER_URL`               | 覆盖开发前端 URL（默认 `http://127.0.0.1:9192`）。                         |
| `KWORKS_WORKSPACE_DIR`         | 覆盖工作区根目录（默认 `~/.kworks-workspace`）。                           |
| `QIONGQI_API_KEY` / `QIONGQI_BASE_URL` / `QIONGQI_MODEL` | 启动时转发给内嵌网关。                                       |

### 默认端口

桌面端网关默认监听 **`127.0.0.1:19987`** —— 刻意与网页端的 `9193` 区分，使两者能在同一台机器上并行运行而不冲突。

### 数据目录

桌面端所有状态位于 `~/.kworks-workspace/`：

```
~/.kworks-workspace/
├── users/<user-id>/         # 每用户数据（线程、会话、产物）
├── config.json              # 生成的网关配置
├── peers.json               # A2A peer 注册表（若启用）
└── logs/                    # 网关与壳的日志
```

### electron-builder 资源映射

`electron-builder.yml` 将以下资源拉入最终应用包：

| 来源                  | 目标           | 内容                                               |
| --------------------- | -------------- | -------------------------------------------------- |
| `dist/**`             | （应用根）     | 编译后的 `main.js` + `preload.cjs`                 |
| `../frontend/out`     | `frontend-out` | Next.js 静态导出                                   |
| `../qiongqi`          | `qiongqi`      | 完整运行时（剔除缓存）                             |
| `../skills`           | `skills`       | 共享技能库                                         |
| `build/icons/*`       | `icons`        | `16x16.png`、`32x32.png`                           |
| `build/icon.png`      | `icon.png`     | Linux 图标                                         |
| `build/icon.icns`     | （macOS）      | macOS dock 图标                                    |
| `build/icon.ico`      | （Windows）    | Windows 可执行文件图标                             |

## 安全模型

- **上下文隔离**已启用；preload 在隔离上下文中运行，仅暴露最小化的 IPC 表面。
- **渲染进程中 `nodeIntegration` 已禁用**。
- **URL 策略**（`src/url-policy.ts`）对 `app://` origin 与少量可信外部主机做白名单；其余一律禁止导航与新窗口创建。
- **单实例锁**防止并行实例争抢同一数据目录。
- **优雅关闭**先向网关发送 `SIGTERM`，等待超时后再升级为 `SIGKILL`。

## 测试

```bash
node --test tests/*.test.mjs
```

18 个测试套件覆盖后端生命周期、单实例行为、多窗口管理、URL 策略、窗口安全、打包断言、开发启动器与 QiongQi 启动配置解析器。

## 架构说明

### 进程模型

```
┌─────────────────────────────────────────────────────────────┐
│ Electron 主进程 (main.ts)                                   │
│  ├─ BackendManager (backend.ts)                             │
│  │    └─ spawns → node qiongqi serve（子进程）              │
│  ├─ Tray + globalShortcut + Menu                            │
│  ├─ BrowserWindow(s) ← app:// frontend-out（静态产物）       │
│  │    └─ preload.cjs（上下文隔离桥）                         │
│  └─ Updater (electron-updater)                              │
└─────────────────────────────────────────────────────────────┘
        │ IPC (ipc.ts)                │ HTTP / SSE on 127.0.0.1:19987
        ▼                             ▼
┌──────────────────┐          ┌────────────────────────────────┐
│ 渲染进程          │ ◀──────  │ QiongQi 运行时（内嵌）           │
│ (Next.js 静态)   │           │ /v1/* + /a2a/* + /health        │
└──────────────────┘          └─────────────────────────────────┘
```

### 开发与打包的解析差异

`frontend-protocol.ts` 决定渲染进程从何处加载：

- **开发** —— 若 `DEV_SERVER_URL`（或默认的 `http://127.0.0.1:9192`）可达，则加载它以获得热更新。
- **打包** —— 注册 `app://` 协议，从内嵌的 `frontend-out/` 加载 `app://-/index.html`。

类似地，`backend.ts` 解析运行时：

- **开发** —— 使用仓库根 `qiongqi/packages/cli-layer/cli/dist/serve-entry.js`（刚构建的开发运行时）。
- **打包** —— 使用 `resources/` 内内嵌的 `qiongqi/` 副本。

## 故障排查

- **`node-pty` 安装失败** —— 确保已安装 C++ 工具链（macOS 的 Xcode CLT）。安装后重新执行 `pnpm run fix-node-pty-permissions`。
- **窗口打开空白** —— 检查 `logs/` 中的后端启动错误；确认渲染进程加载前网关已变为健康状态。
- **19987 端口冲突** —— 可能有另一个桌面实例在运行。单实例锁应能阻止，但崩溃的进程可能仍占用端口；请手动 kill。
- **自动更新未触发** —— `electron-updater` 需要已发布的 release feed；在开发构建中它会是空操作。

## 许可证

MIT —— 详见 [LICENSE](../LICENSE)。
