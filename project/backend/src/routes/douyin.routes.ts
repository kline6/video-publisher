import { Router as ExpressRouter, Request, Response } from 'express';
import { douyinService } from '../services/platforms/douyin.service';
import { douyinApiService } from '../services/platforms/douyin.api';
import { authMiddleware } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';

const router: ExpressRouter = ExpressRouter();

// GET /api/douyin/auth-url \u2014 \u83b7\u53d6\u6296\u97f3\u5b98\u65b9\u6388\u6743\u94fe\u63a5
router.get('/auth-url', authMiddleware, async function(req: Request, res: Response) {
  try {
    if (!douyinService.isOfficialApiConfigured) {
      errorResponse(res, '\u6296\u97f3\u5b98\u65b9 API \u672a\u914d\u7f6e\uff0c\u8bf7\u5728 .env \u4e2d\u8bbe\u7f6e DOUYIN_CLIENT_ID \u548c DOUYIN_CLIENT_SECRET\u3002\u53ef\u4f7f\u7528 Cookie \u7ed1\u5b9a\u65b9\u5f0f\u4ee3\u66ff\u3002', 400);
      return;
    }
    const callbackUrl = req.query.callbackUrl as string | undefined;
    const result = douyinService.getAuthUrl(req.user!.userId, callbackUrl);
    successResponse(res, result);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// GET /api/douyin/callback \u2014 \u6296\u97f3 OAuth \u56de\u8c03\uff08\u5b98\u65b9 API \u6a21\u5f0f\uff09
router.get('/callback', async function(req: Request, res: Response) {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    if (!code || !state) {
      res.redirect((process.env.FRONTEND_URL || 'http://localhost:5173') + '/accounts?bind=error&reason=missing_params');
      return;
    }

    const userId = parseInt(state.split('_')[0], 10);
    if (isNaN(userId)) {
      res.redirect((process.env.FRONTEND_URL || 'http://localhost:5173') + '/accounts?bind=error&reason=invalid_state');
      return;
    }

    await douyinService.handleAuthCallback(code, userId);
    res.redirect((process.env.FRONTEND_URL || 'http://localhost:5173') + '/accounts?bind=success');
  } catch (error: any) {
    console.error('[DouyinCallback] Error:', error.message);
    res.redirect((process.env.FRONTEND_URL || 'http://localhost:5173') + '/accounts?bind=error&reason=token_exchange_failed');
  }
});

// GET /api/douyin/status/:accountId \u2014 \u68c0\u67e5\u6296\u97f3\u8d26\u53f7\u6388\u6743\u72b6\u6001
router.get('/status/:accountId', authMiddleware, async function(req: Request, res: Response) {
  try {
    const accountId = parseInt(req.params.accountId, 10);
    const status = await douyinService.checkAccountStatus(accountId);
    successResponse(res, status);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// GET /api/douyin/works/:accountId \u2014 \u83b7\u53d6\u7528\u6237\u4f5c\u54c1\u5217\u8868
router.get('/works/:accountId', authMiddleware, async function(req: Request, res: Response) {
  try {
    const accountId = parseInt(req.params.accountId, 10);
    const cursor = parseInt((req.query.cursor as string) || '0', 10);
    const count = parseInt((req.query.count as string) || '20', 10);
    const result = await douyinService.getUserWorks(accountId, cursor, count);
    successResponse(res, result);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// GET /api/douyin/stats/:accountId \u2014 \u83b7\u53d6\u6296\u97f3\u8d26\u53f7\u7edf\u8ba1\u6570\u636e
router.get('/stats/:accountId', authMiddleware, async function(req: Request, res: Response) {
  try {
    const accountId = parseInt(req.params.accountId, 10);
    const stats = await douyinService.getAccountStats(accountId);
    successResponse(res, stats);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// POST /api/douyin/webhook \u2014 \u6296\u97f3 Webhook \u56de\u8c03
router.post('/webhook', async function(req: Request, res: Response) {
  try {
    const body = req.body;
    console.log('[DouyinWebhook] Received event:', body && body.event);

    // \u9a8c\u8bc1 webhook
    if (body && body.event === 'VERIFY_WEBHOOK') {
      res.setHeader('Content-Type', 'text/plain');
      const challenge = body.content ? body.content.challenge : '';
      res.send(JSON.stringify({ challenge: challenge }));
      return;
    }

    // \u89c6\u9891\u53d1\u5e03\u6210\u529f
    if (body && body.event === 'CREATE_VIDEO') {
      console.log('[DouyinWebhook] Video published:', JSON.stringify(body).slice(0, 500));
      // \u53ef\u4ee5\u5728\u6b64\u89e6\u53d1\u7edf\u8ba1\u91c7\u96c6
    }

    res.json({ status: 'success', message: 'Event received' });
  } catch (error: any) {
    console.error('[DouyinWebhook] Error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /api/douyin/share-schema \u2014 \u751f\u6210\u5206\u4eab Schema
router.post('/share-schema', authMiddleware, async function(req: Request, res: Response) {
  try {
    const title = req.body.title;
    const video_path = req.body.video_path;
    const hashtag_list = req.body.hashtag_list;
    const clientToken = await douyinApiService.getClientToken();
    const schema = douyinApiService.generateShareSchema(clientToken.access_token, {
      title: title,
      video_path: video_path,
      hashtag_list: hashtag_list,
    });
    successResponse(res, { schema: schema });
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

export default router;
