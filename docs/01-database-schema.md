# Phase 1: 项目架构与数据库设计

## 技术选型决策

### 后端
- **运行时**: Node.js 20 LTS + TypeScript
- **框架**: Express.js（轻量、灵活，适合此类项目）
- **数据库**: PostgreSQL 15（用户明确要求，全文检索、JSON 支持更好）
- **缓存**: Redis 7（会话缓存、热门话题 TTL 缓存）
- **任务队列**: Bull（基于 Redis，处理定时发布和异步视频处理）
- **ORM**: 直接使用 `pg` 驱动 + SQL（更轻量，对复杂查询更友好）

### 前端
- **框架**: React 18 + TypeScript
- **UI 库**: Ant Design 5（组件丰富、中文支持好）
- **构建**: Vite 5（极速 HMR）
- **状态管理**: Zustand（轻量、TypeScript 友好）
- **路由**: React Router 6

### 桌面端
- **框架**: Electron 28
- **打包**: electron-builder（支持 Win/Mac/Linux 全平台）

## 数据库设计

### 表结构概览

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `users` | 用户表 | email, password_hash, role |
| `platform_accounts` | 平台账号绑定 | platform, access_token, refresh_token |
| `publish_tasks` | 发布任务 | platforms[], status, scheduled_at |
| `video_stats` | 视频数据统计 | views, likes, comments, shares |
| `traffic_suggestions` | 流量建议日志 | type, input, output, applied |
| `hot_topics` | 热门话题 | platform, title, heat_value |
| `ai_generations` | AI 生成记录 | type, prompt, result, tokens_used |
| `content_calendar` | 内容日历 | date, time, status, color |

### 设计要点
1. 使用 PostgreSQL 数组类型存储 `platforms` 和 `tags`，避免多对多关系复杂度
2. `JSONB` 字段存储平台特有数据（`extra_data`）和发布结果（`publish_results`）
3. 所有外键使用 `ON DELETE CASCADE` 或 `SET NULL`，确保数据一致性
4. 关键查询字段均有索引

### 迁移策略
- 使用自建迁移系统（`migrations` 表记录已执行的迁移）
- 支持 forward（`pnpm migrate`）和 rollback（`pnpm migrate:rollback`）
- 迁移文件内嵌在 `migrate.ts` 中，便于版本控制
