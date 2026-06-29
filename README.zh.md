**English**: [README.md](./README.md)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/cover.svg">
    <img alt="KWorks— Open-Source Super Agent Platform" src="assets/cover.svg" width="100%" />
  </picture>
</p>


# KWorks

KWorks 是一个本地优先的 AI 工作区，由三个主要部分组成：

- `frontend/` - Next.js 网页前端。
- `qiongqi/` - QiongQi TypeScript 运行时与 API 网关。
- `desktop/` - Electron 桌面壳。

QiongQi 的唯一有效源码位置位于仓库根目录的 `qiongqi/`。
旧的 `third_party/qiongqi` 路径是迁移遗留物，不应用于新代码。

## 快速开始

在你需要的工作区安装依赖：

```bash
cd qiongqi && pnpm install
cd ../frontend && pnpm install
cd ../desktop && pnpm install
```

启动完整本地栈前先构建 QiongQi：

```bash
cd qiongqi
pnpm run build
cd ..
./start.sh start
```

`./start.sh` 委托 `scripts/serve.mjs` 执行，默认启动 QiongQi 网关在
端口 `9193`，前端在端口 `9192`。

常用服务命令：

```bash
./start.sh status
./start.sh logs
./start.sh stop
./start.sh restart
```

## 开发检查

```bash
cd frontend && pnpm lint && pnpm typecheck && pnpm test
cd qiongqi && pnpm typecheck && pnpm test:fast
cd desktop && pnpm lint && node --test tests/*.test.mjs
```

桌面端打包时，`desktop/electron-builder.yml` 会包含前端静态构建产物、
根目录 `qiongqi/` 运行时、共享的 `skills/` 以及桌面图标资源。
