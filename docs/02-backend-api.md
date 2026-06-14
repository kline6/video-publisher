# Phase 2: 后端 API 设计

## API 路由总览

### 认证模块 `/api/auth`
| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| POST | `/register` | 用户注册 | 否 |
| POST | `/login` | 用户登录 | 否 |
| GET | `/profile` | 获取个人信息 | 是 |
| PUT | `/profile` | 更新个人信息 | 是 |

### 平台管理 `/api/platforms`
| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| GET | `/` | 获取已绑定账号 | 是 |
| GET | `/auth-url/:platform` | 获取 OAuth 授权 URL | 是 |
| GET | `/callback/:platform` | OAuth 回调 | 否 |
| DELETE | `/:id` | 解绑平台账号 | 是 |

### 发布任务 `/api/publish`
| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| POST | `/` | 创建发布任务 | 是 |
| GET | `/` | 获取任务列表（分页、筛选） | 是 |
| GET | `/:id` | 获取任务详情 | 是 |
| DELETE | `/:id` | 删除任务 | 是 |

### 流量分析 `/api/traffic`
| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| GET | `/dashboard` | 数据看板 | 是 |
| GET | `/hot-topics` | 热门话题 | 是 |
| POST | `/hot-topics/refresh` | 刷新热门话题 | 是 |
| GET | `/best-time` | 最佳发布时间 | 是 |
| GET | `/competitor-analysis` | 竞品分析 | 是 |
| GET | `/suggestions` | 建议历史 | 是 |

### AI 服务 `/api/ai`
| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| POST | `/generate-script` | 生成视频脚本 | 是 |
| POST | `/generate-titles` | 生成高点击率标题 | 是 |
| POST | `/generate-tags` | 生成 SEO 标签 | 是 |
| POST | `/generate-description` | 生成视频描述 | 是 |
| POST | `/generate-cover-prompt` | 生成封面提示词 | 是 |
| GET | `/history` | AI 生成历史 | 是 |

### 内容日历 `/api/calendar`
| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| GET | `/` | 获取日历事件 | 是 |
| POST | `/` | 创建事件 | 是 |
| PUT | `/:id` | 更新事件 | 是 |
| DELETE | `/:id` | 删除事件 | 是 |

## 错误处理策略
- 所有错误返回统一格式: `{ success: false, error: "message" }`
- Zod 验证器校验请求体
- JWT 中间件统一认证
- 全局错误中间件捕获未处理异常

## 任务队列
- `publish-tasks` 队列处理视频发布
- `task-scheduler` 队列每分钟检查定时任务
- 支持重试（指数退避，最多 3 次）
- Bull Board 可选监控面板
