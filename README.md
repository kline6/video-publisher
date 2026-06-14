# VideoFlow + AiToEarn 项目

多平台视频发布与流量增长桌面应用，包含两套系统：
- **VideoFlow**（`project/` 目录）：自研的多平台视频发布系统
- **AiToEarn**（`AiToEarn-ref/` 目录）：基于 AiToEarn 开源项目的二次开发

## 项目结构

```
├── project/              # VideoFlow 主项目
│   ├── backend/          # Node.js + Express + TypeScript 后端
│   ├── frontend/         # React + TypeScript + Ant Design 前端
│   ├── electron/         # Electron 桌面端
│   └── docker/           # Docker 配置
├── AiToEarn-ref/         # AiToEarn 项目（二次开发版）
├── redis/                # Redis for Windows（免安装）
├── mongodb-7.0/          # MongoDB for Windows（免安装）
├── docs/                 # 项目文档
├── start-*.bat           # 各种启动脚本
└── start-all.ps1         # 一键启动脚本
```

## 新电脑迁移指南

### 1. 克隆仓库

```bash
git clone https://github.com/kline6/gongzhonghaoxiangmu.git
cd gongzhonghaoxiangmu
```

### 2. 安装基础环境

| 软件 | 版本要求 | 下载地址 |
|------|---------|---------|
| Node.js | v20+ LTS | https://nodejs.org |
| pnpm | 最新版 | `npm install -g pnpm` |
| Docker Desktop | 最新版（可选） | https://docker.com |

### 3. 下载二进制工具（数据库 + Redis）

> 以下工具不包含在 Git 仓库中，需单独下载。

#### MongoDB
```bash
# 从 https://www.mongodb.com/download-center/community 下载 MongoDB 7.0 for Windows
# 解压到项目根目录下的 mongodb-7.0/ 文件夹
# 创建数据目录
mkdir mongodb-data
```

#### Redis（Windows）
```bash
# 从 https://github.com/tporadowski/redis/releases 下载 Redis for Windows
# 解压到项目根目录下的 redis/ 文件夹
```

#### PostgreSQL（推荐用 Docker）
```bash
# 方案A（推荐）：用 Docker
docker-compose -f project/docker-compose.yml up -d
# 会自动启动 PostgreSQL 15 + Redis 7

# 方案B：手动安装 PostgreSQL 15+
# https://www.postgresql.org/download/windows/
# 安装后创建数据库：
# psql -U postgres
# CREATE USER videouser WITH PASSWORD 'videopass';
# CREATE DATABASE videoflow OWNER videouser;
```

### 4. 安装项目依赖

```bash
# VideoFlow 后端
cd project/backend
pnpm install

# VideoFlow 前端
cd ../frontend
pnpm install

# AiToEarn（如需要）
cd ../../AiToEarn-ref
pnpm install
```

### 5. 配置环境变量

```bash
# VideoFlow 后端配置
cp project/backend/.env.example project/backend/.env
# 编辑 .env 填入你的配置
```

关键配置项说明：

| 配置项 | 文件 | 说明 |
|--------|------|------|
| `DB_HOST/PORT` | `project/backend/.env` | PostgreSQL 连接，默认 localhost:5432 |
| `REDIS_HOST/PORT` | `project/backend/.env` | Redis 连接，默认 localhost:6379 |
| `OPENAI_API_KEY` | `project/backend/.env` | OpenAI API 密钥 |
| `JWT_SECRET` | `project/backend/.env` | JWT 认证密钥（换电脑后修改会导致登录失效） |
| 平台 OAuth | `project/backend/.env` | 抖音/B站/YouTube 等平台的 API 密钥 |
| `MONGODB_HOST/PORT` | 启动脚本内 | MongoDB 连接，默认 127.0.0.1:27017 |

### 6. 数据库迁移

```bash
cd project/backend
pnpm migrate
```

### 7. 启动服务

#### VideoFlow（一键启动）
```powershell
# PowerShell
powershell -ExecutionPolicy Bypass -File start-all.ps1
```

#### VideoFlow（手动启动）
```bash
# 终端1：启动后端
cd project/backend
pnpm dev

# 终端2：启动前端
cd project/frontend
pnpm dev --host
```

#### AiToEarn
```bash
# 双击运行 start-aitoearn.bat
# 或手动启动：
cd AiToEarn-ref
npx nx serve aitoearn-server
```

### 8. 访问服务

| 服务 | 地址 |
|------|------|
| VideoFlow 前端 | http://localhost:5173 |
| VideoFlow 后端 API | http://localhost:3000 |
| AiToEarn 后端 | http://localhost:3001 |

## Docker 部署

```bash
# 开发环境（仅数据库）
docker-compose -f project/docker-compose.yml up -d

# 生产环境（全量部署）
docker-compose -f project/docker-compose.prod.yml up -d
```

## 注意事项

- `.env` 文件包含敏感信息，已在 `.gitignore` 中排除，不会上传到 GitHub
- `node_modules/` 不包含在仓库中，需要手动 `pnpm install`
- `mongodb-data/` 和 `dump.rdb` 是数据库数据文件，不包含在仓库中
- `redis/` 和 `mongodb-7.0/` 是二进制工具，需要单独下载
- 换电脑后如果路径不同（不是 `E:\gongzhonghaoxiangmu\`），需要修改 `start-all.ps1` 和各 `.bat` 文件中的路径

## 许可证

MIT
