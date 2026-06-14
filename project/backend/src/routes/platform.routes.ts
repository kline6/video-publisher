import { Router as ExpressRouter, Request, Response } from 'express';
import { platformService } from '../services/platform.service';
import { authMiddleware } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { Platform } from '../types';

const router: ExpressRouter = ExpressRouter();

// GET /api/platforms — 获取已绑定的平台账号
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const accounts = await platformService.getAccounts(req.user!.userId);
    successResponse(res, accounts);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// GET /api/platforms/auth-url/:platform — 获取 OAuth 授权链接
router.get('/auth-url/:platform', authMiddleware, async (req: Request, res: Response) => {
  try {
    const platform = req.params.platform as Platform;
    if (!platformService.isPlatformConfigured(platform)) {
      errorResponse(res, '该平台需要先在 .env 中配置 OAuth ClientId/Secret 才能使用。B站请使用 Cookie 绑定方式。', 400);
      return;
    }
    const state = req.user!.userId + '_' + Date.now();
    const url = platformService.getAuthUrl(platform, state);
    successResponse(res, { url, state });
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// POST /api/platforms/bind-bilibili — B站 Cookie 绑定（真实绑定）
router.post('/bind-bilibili', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { sessdata, bili_jct, dedeuserid } = req.body;
    if (!sessdata || !bili_jct) {
      errorResponse(res, '请提供 SESSDATA 和 bili_jct Cookie', 400);
      return;
    }
    const account = await platformService.bindBilibiliByCookie(
      req.user!.userId, sessdata, bili_jct, dedeuserid
    );
    successResponse(res, account, 'B站账号绑定成功！', 201);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// GET /api/platforms/check-config/:platform — 检查平台是否已配置
router.get('/check-config/:platform', authMiddleware, async (req: Request, res: Response) => {
  try {
    const platform = req.params.platform as Platform;
    const configured = platformService.isPlatformConfigured(platform);
    successResponse(res, { configured });
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// GET /api/platforms/callback/:platform — OAuth 回调
router.get('/callback/:platform', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query as { code: string; state: string };
    const userId = parseInt(state.split('_')[0], 10);
    const platform = req.params.platform as Platform;
    await platformService.handleCallback(platform, code, userId);
    res.redirect((process.env.FRONTEND_URL || 'http://localhost:5173') + '/accounts?bind=success');
  } catch (error: any) {
    res.redirect((process.env.FRONTEND_URL || 'http://localhost:5173') + '/accounts?bind=error');
  }
});

// DELETE /api/platforms/:id — 解绑平台账号
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.id, 10);
    const deleted = await platformService.deleteAccount(accountId, req.user!.userId);
    if (deleted) {
      successResponse(res, null, 'Account unlinked');
    } else {
      errorResponse(res, 'Account not found', 404);
    }
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});


// POST /api/platforms/bind-douyin — 抖音 Cookie 绑定
router.post('/bind-douyin', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { cookie, nickname, uid } = req.body;
    if (!cookie) { errorResponse(res, '请提供抖音 Cookie', 400); return; }
    const account = await platformService.bindDouyinByCookie(req.user!.userId, cookie, nickname, uid);
    successResponse(res, account, '抖音账号绑定成功！', 201);
  } catch (error: any) { errorResponse(res, error.message); }
});

// POST /api/platforms/bind-kuaishou — 快手 Cookie 绑定
router.post('/bind-kuaishou', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { cookie, did } = req.body;
    if (!cookie || !did) { errorResponse(res, '请提供快手 Cookie 和 DID', 400); return; }
    const account = await platformService.bindKuaishouByCookie(req.user!.userId, cookie, did);
    successResponse(res, account, '快手账号绑定成功！', 201);
  } catch (error: any) { errorResponse(res, error.message); }
});



// POST /api/platforms/douyin-login — Launch Playwright QR code login
router.post('/douyin-login', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { douyinScanLogin } = await import('../services/platforms/douyin.login');
    const result = await douyinScanLogin();
    if (result.success) {
      // Auto-bind the account
      const account = await platformService.bindDouyinFull(req.user!.userId, result.cookie!, result.tokens, result.userInfo?.nickname, result.userInfo?.uid, result.userInfo?.avatar, result.storageStatePath);
      successResponse(res, { account, userInfo: result.userInfo }, '抖音扫码登录成功！');
    } else {
      errorResponse(res, result.error || '登录失败', 400);
    }
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// POST /api/platforms/bind-douyin-full — Bind Douyin with cookie + tokens
router.post('/bind-douyin-full', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { cookie, tokens, nickname, uid, avatar } = req.body;
    if (!cookie) { errorResponse(res, '请提供抖音 Cookie', 400); return; }
    const account = await platformService.bindDouyinFull(
      req.user!.userId, cookie, tokens, nickname, uid, avatar
    );
    successResponse(res, account, '抖音账号绑定成功！（含 tokens）', 201);
  } catch (error: any) { errorResponse(res, error.message); }
});


export default router;


