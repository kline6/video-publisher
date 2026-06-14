import { Router as ExpressRouter, Request, Response } from 'express';
import { settingsService } from '../services/settings.service';
import { authMiddleware } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';

const router: ExpressRouter = ExpressRouter();

// GET /api/settings — 获取当前用户设置
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const settings = await settingsService.getOrCreateSettings(req.user!.userId);
    // 隐藏 API Key 中间部分
    const safeSettings = {
      ...settings,
      ai_api_key: settings.ai_api_key
        ? settings.ai_api_key.slice(0, 7) + '...' + settings.ai_api_key.slice(-4)
        : '',
    };
    successResponse(res, safeSettings);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// PUT /api/settings — 更新设置
router.put('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { ai_api_url, ai_api_key, ai_model, ai_available_models } = req.body;
    const settings = await settingsService.updateSettings(req.user!.userId, {
      ai_api_url,
      ai_api_key,
      ai_model,
      ai_available_models,
    });
    successResponse(res, {
      ...settings,
      ai_api_key: settings.ai_api_key
        ? settings.ai_api_key.slice(0, 7) + '...' + settings.ai_api_key.slice(-4)
        : '',
    }, 'Settings updated');
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// POST /api/settings/test-ai — 测试 AI 连接
router.post('/test-ai', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { ai_api_url, ai_api_key } = req.body;
    if (!ai_api_url || !ai_api_key) {
      errorResponse(res, '请提供 API URL 和 API Key');
      return;
    }
    const result = await settingsService.testAiConnection(ai_api_url, ai_api_key);
    successResponse(res, result);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// POST /api/settings/fetch-models — 获取可用模型列表
router.post('/fetch-models', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { ai_api_url, ai_api_key } = req.body;
    if (!ai_api_url || !ai_api_key) {
      errorResponse(res, '请提供 API URL 和 API Key');
      return;
    }
    const result = await settingsService.fetchAvailableModels(ai_api_url, ai_api_key);
    successResponse(res, result);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

export default router;
