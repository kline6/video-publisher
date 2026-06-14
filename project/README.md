# VideoFlow - 视频发布与流量增长应用

基于 AiToEarn 二次开发的多平台视频发布与流量增长桌面应用。

## 技术栈

- **后端**: Node.js + Express + TypeScript + PostgreSQL + Redis + Bull
- **前端**: React + TypeScript + Tailwind CSS + Ant Design
- **桌面端**: Electron
- **部署**: Docker + Nginx
- **AI**: OpenAI API / 国内大模型

## 核心功能

1. 多平台视频发布（抖音、快手、B站、视频号、YouTube、TikTok）
2. AI 视频创作辅助（脚本生成、标题优化、封面生成）
3. 流量优化建议（热点追踪、最佳发布时间、标签策略）
4. 跨平台数据看板
5. 多账号管理
6. 内容日历排期
7. 桌面应用打包

## 快速开始

### 环境要求

- Node.js v20+
- pnpm
- Docker + Docker Compose
- PostgreSQL 15+

### 本地开发

```bash
# 1. 克隆项目
git clone <your-repo> videoflow
cd videoflow

# 2. 安装依赖
pnpm install

# 3. 启动数据库
docker-compose up -d postgres redis

# 4. 运行数据库迁移
cd backend
pnpm migrate

# 5. 启动后端
pnpm dev

# 6. 启动前端（新终端）
cd frontend
pnpm dev

# 7. 启动 Electron（新终端）
cd electron
pnpm dev
```

### Docker 部署

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Electron 打包

```bash
cd electron
pnpm build
```

## 项目结构

```
project/
├── backend/          # Express + TypeScript 后端
│   ├── src/
│   │   ├── controllers/   # 请求控制器
│   │   ├── services/      # 业务逻辑层
│   │   ├── models/        # 数据模型
│   │   ├── routes/        # 路由定义
│   │   ├── middleware/     # 中间件
│   │   ├── config/        # 配置文件
│   │   ├── jobs/          # Bull 任务队列
│   │   └── utils/         # 工具函数
│   └── migrations/        # 数据库迁移
├── frontend/         # React + TypeScript 前端
│   ├── src/
│   │   ├── components/    # 通用组件
│   │   ├── pages/         # 页面组件
│   │   ├── hooks/         # 自定义 Hooks
│   │   ├── services/      # API 调用层
│   │   ├── stores/        # 状态管理
│   │   └── styles/        # 全局样式
│   └── public/
├── electron/         # Electron 主进程
└── docker/           # Docker 配置
```

## 环境变量

参考 `.env.example` 文件配置所需环境变量。

## 许可证

MIT
