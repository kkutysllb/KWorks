# 贡献指南

感谢你对 KWorks 的关注！本文档将帮助你搭建开发环境并了解开发工作流程。

## 开发环境搭建

### 前置条件

- Node.js 20+
- pnpm 10+
- nginx

```bash
make check
```

### 方式一：本地开发

1. **配置应用**：
   ```bash
   make config
   ```
   在 `.env` 文件中设置 API 密钥。

2. **安装依赖**：
   ```bash
   make install
   ```

3. **启动开发服务**：
   ```bash
   ./start.sh start
   ```

4. **访问应用**：
   - 网页界面：http://localhost:9191
   - Gateway API：http://localhost:9191/api/*

### 方式二：Docker 开发

```bash
make docker-init
make docker-start
```

## 项目结构

```
KWorks/
├── config.example.yaml              # 配置模板
├── extensions_config.example.json   # MCP 和 Skills 配置模板
├── start.sh                         # 统一服务管理脚本
├── scripts/
│   └── serve.mjs                   # 服务编排入口
├── frontend/                        # 前端应用（Next.js + React + TypeScript）
│   └── src/
│       ├── app/                     # Next.js App Router
│       ├── components/              # React 组件
│       ├── core/                    # 核心业务逻辑
│       └── hooks/                   # React Hooks
├── desktop/                         # 桌面端（Electron 33+）
│   ├── src/
│   │   ├── main.ts                  # Electron 主进程
│   │   ├── preload.ts               # 预加载脚本
│   │   └── updater.ts               # 自动更新
│   └── scripts/
│       └── dev.mjs                  # 桌面端开发脚本
├── third_party/qiongqi/             # QiongQi 引擎（TypeScript monorepo）
│   └── packages/                    # 18 个独立 npm 包
├── skills/                          # Agent 技能
│   ├── public/                      # 公共技能
│   └── custom/                      # 自定义技能
└── docs/                            # 技术文档
```

## 架构

```
浏览器 / 桌面端
  ↓
Nginx（端口 9191）← 统一入口
  ├→ Frontend（端口 9192）← /（非 API 请求）
  └→ QiongQi Engine（端口 9193）← /api/*（API 请求 + SSE 流式）
```

## 服务端口

| 服务 | 默认端口 | 环境变量 |
|------|---------|----------|
| Nginx | 9191 | `NGINX_PORT` |
| Frontend | 9192 | `FRONTEND_PORT` |
| Gateway | 9193 | `GATEWAY_PORT` |

## 开发工作流程

1. **创建功能分支**：
   ```bash
   git checkout -b feature/your-feature
   ```

2. **修改代码**（支持热重载）

3. **格式化与代码检查**：
   ```bash
   # 前端
   cd frontend
   pnpm format:write   # Prettier

   # QiongQi 引擎
   cd third_party/qiongqi
   pnpm test           # 运行测试（510+ 测试用例）
   ```

4. **提交修改**：
   ```bash
   git add .
   git commit -m "feat: 描述你的修改"
   ```

5. **推送并创建 Pull Request**

## 命令速查

```bash
./start.sh start              # 启动所有服务（开发模式，热重载）
./start.sh start docker       # Docker 生产模式启动
./start.sh stop               # 停止所有服务
./start.sh restart            # 重启所有服务
./start.sh status             # 查看服务运行状态
./start.sh logs               # 查看所有服务日志
./start.sh clean              # 清理缓存文件

# 桌面端
cd desktop
pnpm run dev                  # 开发模式
pnpm run build:app            # 生产构建
```

## 文档

- [架构概述](docs/ARCHITECTURE.md) — 系统架构（QiongQi 引擎）
- [配置指南](docs/CONFIGURATION.md) — 设置与配置
- [API 参考](docs/API.md) — 完整 API 文档
- [安装指南](docs/SETUP.md) — 快速安装

## 需要帮助？

- 查看已有的 [Issues](https://github.com/kkutysllb/kk_KWorks/issues)
- 阅读[文档](docs/)

## 许可证

向 KWorks 贡献代码，即表示你同意你的贡献将按照 [MIT 许可证](./LICENSE) 进行许可。
