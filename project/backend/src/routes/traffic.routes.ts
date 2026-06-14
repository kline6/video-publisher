import { Router as ExpressRouter, Request, Response } from 'express';
import { trafficService } from '../services/traffic.service';
import { authMiddleware } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';

const router: ExpressRouter = ExpressRouter();

// GET /api/traffic/dashboard — 数据看板
router.get('/dashboard', authMiddleware, async (req: Request, res: Response) => {
  try {
    const stats = await trafficService.getDashboard(req.user!.userId);
    successResponse(res, stats);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// GET /api/traffic/hot-topics — 热门话题
router.get('/hot-topics', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { platform, limit } = req.query;
    const topics = await trafficService.getHotTopics(
      platform as any,
      limit ? parseInt(limit as string, 10) : undefined
    );
    successResponse(res, topics);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// POST /api/traffic/hot-topics/refresh — 刷新热门话题
router.post('/hot-topics/refresh', authMiddleware, async (req: Request, res: Response) => {
  try {
    await trafficService.refreshHotTopics();
    successResponse(res, null, 'Hot topics refreshed');
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// GET /api/traffic/best-time — 推荐最佳发布时间
router.get('/best-time', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { platform } = req.query;
    const bestTimes = await trafficService.getBestTime(req.user!.userId, platform as any);
    successResponse(res, bestTimes);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// GET /api/traffic/competitor-analysis — 竞品分析
router.get('/competitor-analysis', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { platform, keywords } = req.query;
    const analysis = await trafficService.competitorAnalysis(
      platform as any,
      (keywords as string || '').split(',')
    );
    successResponse(res, analysis);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// GET /api/traffic/suggestions — 获取建议历史
router.get('/suggestions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const suggestions = await trafficService.getSuggestionHistory(req.user!.userId, type as string);
    successResponse(res, suggestions);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

export default router;
