# 浏览器插件模�?

## 📁 文件结构

```
src/store/plugin/
├── index.ts              # 统一导出
├── request.ts            # 插件代理请求封装
├── store.ts              # Zustand Store 状态管�?
├── hooks.ts              # 自定�?Hooks
├── baseTypes.ts              # TypeScript 类型定义
├── constants.ts          # 常量定义
├── utils.ts              # 工具函数
├── README.md             # 本文�?
└── examples/             # 使用示例
    ├── basic.example.tsx
    └── advanced.example.tsx
```

## 🚀 快速开�?

### 1. 基础使用

```typescript
import { usePlugin } from '@/store/plugin';

export function MyComponent() {
  // 自动轮询插件状态，�?秒检测一�?
  const { isConnected, status } = usePlugin(true, 2000);

  return (
    <div>
      状�? {isConnected ? '已连�? : '未连�?}
    </div>
  );
}
```

### 2. 登录功能

```typescript
import { usePluginLogin } from '@/store/plugin';

export function LoginButton() {
  const { login } = usePluginLogin();

  const handleLogin = async () => {
    const result = await login('douyin');
    if (result.success) {
      console.log('登录成功:', result.data?.nickname);
    }
  };

  return <button onClick={handleLogin}>登录抖音</button>;
}
```

### 3. 发布视频

```typescript
import { usePluginPublish } from '@/store/plugin';

export function PublishVideo() {
  const { publishVideo, isPublishing, publishProgress } = usePluginPublish();

  const handlePublish = async (videoFile: File, coverFile: File) => {
    const result = await publishVideo(
      'douyin',
      videoFile,
      coverFile,
      { title: '我的视频', desc: '描述' },
      (progress) => console.log(`进度: ${progress.progress}%`)
    );

    if (result.success) {
      alert('发布成功�?);
    }
  };

  return (
    <div>
      <button onClick={() => handlePublish(...)} disabled={isPublishing}>
        {isPublishing ? '发布�?..' : '发布视频'}
      </button>
      {publishProgress && <div>进度: {publishProgress.progress}%</div>}
    </div>
  );
}
```

### 4. 完整工作�?

```typescript
import { usePluginWorkflow } from '@/store/plugin';

export function OneClickPublish() {
  const { loginAndPublishVideo } = usePluginWorkflow();

  const handleOneClick = async (videoFile: File, coverFile: File) => {
    // 自动登录 + 发布
    const result = await loginAndPublishVideo(
      'douyin',
      videoFile,
      coverFile,
      { title: '标题' }
    );

    if (result.success) {
      alert('发布成功�?);
    }
  };

  return <button onClick={() => handleOneClick(...)}>一键发�?/button>;
}
```

### 5. 代理请求

```typescript
import { proxyRequest } from '@/store/plugin'

const response = await proxyRequest({
  url: 'https://httpbin.org/anything',
  headers: {
    accept: 'application/json',
  },
  body: {
    source: 'videoflow-website',
  },
})

console.log(response.status, response.body)
```

## 📚 API 文档

### Hooks

#### `usePlugin(autoPolling?, pollingInterval?)`

基础插件状态和方法

**参数:**

- `autoPolling` - 是否自动轮询，默�?`true`
- `pollingInterval` - 轮询间隔（毫秒），默�?`2000`

**返回:**

```typescript
{
  status: PluginStatus;
  isConnected: boolean;
  isNotInstalled: boolean;
  isChecking: boolean;
  isPublishing: boolean;
  publishProgress: ProgressEvent | null;
  checkPlugin: () => boolean;
  startPolling: (interval?: number) => void;
  stopPolling: () => void;
  login: (platform: PlatformType) => Promise<PlatAccountInfo>;
  publish: (params: PublishParams, onProgress?) => Promise<PublishResult>;
  resetPublishState: () => void;
}
```

#### `usePluginLogin()`

登录功能

**返回:**

```typescript
{
  login: (platform: PlatformType) => Promise<OperationResult<PlatAccountInfo>>
}
```

#### `usePluginPublish()`

发布功能

**返回:**

```typescript
{
  publish: (params: PublishParams, onProgress?) => Promise<OperationResult>;
  publishVideo: (platform, video, cover, options?, onProgress?) => Promise<OperationResult>;
  publishImages: (platform, images, options?, onProgress?) => Promise<OperationResult>;
  isPublishing: boolean;
  publishProgress: ProgressEvent | null;
  resetPublishState: () => void;
}
```

#### `usePluginWorkflow()`

完整工作流（登录+发布�?

**返回:**

```typescript
{
  isConnected: boolean;
  loginAndPublishVideo: (...) => Promise<OperationResult>;
  loginAndPublishImages: (...) => Promise<OperationResult>;
}
```

### 工具函数

```typescript
// 状态文�?
getPluginStatusText(status: PluginStatus): string;
getPublishStageText(stage: ProgressEvent['stage']): string;

// 状态判�?
isPluginConnected(status: PluginStatus): boolean;
isPluginNotInstalled(status: PluginStatus): boolean;

// 格式�?
formatProgress(progress: number): string;
formatFileSize(bytes: number): string;

// 文件验证
validateFileType(file: File, acceptTypes: string[]): boolean;
isValidVideoFile(file: File): boolean;
isValidImageFile(file: File): boolean;
validateFileSize(file: File, maxSize: number): boolean;

// 重试机制
withRetry<T>(fn: () => Promise<T>, maxRetries?, delay?): () => Promise<T>;
```

### 类型定义

```typescript
// 插件状�?
enum PluginStatus {
  UNKNOWN = 'UNKNOWN',
  CHECKING = 'CHECKING',
  CONNECTED = 'CONNECTED',
  NOT_INSTALLED = 'NOT_INSTALLED',
}

// 平台类型
type PlatformType = 'douyin' | 'xhs' | 'kwai' | 'bilibili'

// 发布参数
interface PublishParams {
  platform: PlatformType
  type: 'video' | 'image'
  title?: string
  desc?: string
  video?: File | string
  cover?: File | string
  images?: (File | string)[]
  topics?: string[]
  visibility?: 'public' | 'private' | 'friends'
  // ...更多字段
}

// 操作结果
interface OperationResult<T = any> {
  success: boolean
  data?: T
  error?: string
}
```

### 常量

```typescript
// 默认轮询间隔�?秒）
DEFAULT_POLLING_INTERVAL = 2000

// 插件状态文�?
PLUGIN_STATUS_TEXT = {
  UNKNOWN: '未检�?,
  CHECKING: '检测中...',
  CONNECTED: '已连�?,
  NOT_INSTALLED: '未安�?,
}

// 发布阶段文本
PUBLISH_STAGE_TEXT = {
  download: '下载资源',
  upload: '上传文件',
  publish: '发布�?,
  complete: '完成',
  error: '错误',
}

// 错误消息
ERROR_MESSAGES = {
  PLUGIN_NOT_INSTALLED: '请先安装 Aitoearn 浏览器插�?,
  PUBLISHING_IN_PROGRESS: '当前正在发布中，请稍后再�?,
  LOGIN_FAILED: '登录失败',
  PUBLISH_FAILED: '发布失败',
}
```

## 💡 使用示例

### 示例 1: 插件状态显�?

```typescript
import { usePlugin, getPluginStatusText } from '@/store/plugin';

export function PluginStatus() {
  const { status } = usePlugin();

  return (
    <div>
      插件状�? {getPluginStatusText(status)}
    </div>
  );
}
```

### 示例 2: 文件验证

```typescript
import { isValidVideoFile, validateFileSize } from '@/store/plugin'

function handleFileSelect(file: File) {
  if (!isValidVideoFile(file)) {
    alert('请选择有效的视频文�?)
    return
  }

  if (!validateFileSize(file, 500 * 1024 * 1024)) {
    alert('视频文件不能超过 500MB')
    return
  }

  // 处理文件...
}
```

### 示例 3: 带重试的发布

```typescript
import { usePluginPublish, withRetry } from '@/store/plugin';

export function PublishWithRetry() {
  const { publish } = usePluginPublish();

  const handlePublish = async (params: PublishParams) => {
    // 最多重�?3 次，每次延迟 2 �?
    const publishWithRetry = withRetry(
      () => publish(params),
      3,
      2000
    );

    try {
      const result = await publishWithRetry();
      console.log('发布成功:', result);
    } catch (error) {
      console.error('重试后仍然失�?', error);
    }
  };

  return <button onClick={() => handlePublish(...)}>发布</button>;
}
```

### 示例 4: 进度展示

```typescript
import { usePluginPublish, formatProgress, getPublishStageText } from '@/store/plugin';
import { Progress } from 'antd';

export function PublishWithProgress() {
  const { publishVideo, publishProgress } = usePluginPublish();

  return (
    <div>
      {publishProgress && (
        <>
          <Progress percent={publishProgress.progress} />
          <p>
            {getPublishStageText(publishProgress.stage)}: {formatProgress(publishProgress.progress)}
          </p>
        </>
      )}
    </div>
  );
}
```

## 📝 注意事项

1. **轮询管理**
   - 使用 `usePlugin` 时会自动管理轮询
   - 组件卸载时会自动清理定时�?
   - 无需手动调用 `stopPolling()`

2. **错误处理**
   - Hooks 返回的方法都使用 `OperationResult` 格式
   - 包含 `success`、`data` �?`error` 字段
   - 建议使用这种方式而不�?try-catch

3. **文件大小限制**
   - 视频: 建议 �?500MB
   - 图片: 建议每张 �?10MB
   - 图文: 最�?9 �?

4. **并发限制**
   - 同一时间只能有一个发布任�?
   - `isPublishing` �?`true` 时无法开始新发布

5. **平台差异**
   - 不同平台支持的功能可能不�?
   - 参考各平台的具体文�?

## 🔗 相关链接

- [Web API 文档](../../../demo/docs/WEB_API.md)
- [类型定义](../../../demo/PublishType/)
- [示例代码](./examples/)

## 📞 技术支�?

如有问题或建议，请联系技术支持团队�?

---

**版本**: 1.0.0  
**最后更�?*: 2025-12-01
