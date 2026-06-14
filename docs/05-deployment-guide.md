# Phase 5: 部署指南

## 本地开发环境

### 前置要求
- Node.js v20+（推荐使用 nvm 管理版本）
- pnpm v8+
- Docker + Docker Compose
- Git

### 启动步骤

```bash
# 1. 启动 PostgreSQL 和 Redis
docker-compose up -d

# 2. 安装后端依赖
cd backend
cp ../.env.example .env
pnpm install

# 3. 运行数据库迁移
pnpm migrate

# 4. 启动后端开发服务器
pnpm dev

# 5. 安装前端依赖（新终端）
cd frontend
pnpm install

# 6. 启动前端开发服务器
pnpm dev

# 7. 浏览器访问 http://localhost:5173
```

### 环境变量
复制 `.env.example` 到 `backend/.env`，根据需要修改：
- `OPENAI_API_KEY`: OpenAI API 密钥（必须配置才能使用 AI 功能）
- `JWT_SECRET`: 生产环境务必更换为强密码
- 各平台 OAuth 密钥：按需配置

## Docker 生产部署

```bash
# 1. 配置环境变量
cp .env.example .env.production
# 编辑 .env.production

# 2. 准备 SSL 证书
mkdir -p docker/ssl
# 将 cert.pem 和 key.pem 放入 docker/ssl/

# 3. 构建并启动
docker-compose -f docker-compose.prod.yml up -d --build

# 4. 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

## Electron 桌面应用

### 开发模式
```bash
cd electron
pnpm install
pnpm dev  # 同时启动前端和 Electron
```

### 打包
```bash
# Windows
pnpm build:win

# macOS
pnpm build:mac

# Linux
pnpm build:linux
```

产出文件在 `electron/dist/` 目录下。

## 注意事项
1. 生产环境必须修改所有默认密码和密钥
2. PostgreSQL 建议配置自动备份
3. Redis 建议设置密码
4. 视频文件上传需要配置对象存储（如阿里云 OSS、AWS S3）
5. 各平台 OAuth 需要在各开放平台注册应用并获取密钥
