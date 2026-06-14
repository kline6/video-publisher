import { Router as ExpressRouter, Request, Response } from 'express';
import { z } from 'zod';
import { publishService } from '../services/publish.service';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response';

const router: ExpressRouter = ExpressRouter();

const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    video_url: z.string().min(1).optional(),
    cover_url: z.string().optional(),
    platforms: z.array(z.enum(['douyin', 'bilibili', 'youtube', 'kuaishou', 'weixin', 'tiktok'])).min(1),
    scheduled_at: z.string().datetime().optional(),
  }),
});

// POST /api/publish — 创建发布任务
router.post('/', authMiddleware, validate(createTaskSchema), async (req: Request, res: Response) => {
  try {
    const task = await publishService.createTask(req.user!.userId, req.body);
    successResponse(res, task, 'Task created', 201);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// GET /api/publish — 获取任务列表
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', status } = req.query;
    const result = await publishService.getTasks(req.user!.userId, {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      status: status as any,
    });
    paginatedResponse(res, result.tasks, result.total, parseInt(page as string, 10), parseInt(limit as string, 10));
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// GET /api/publish/:id — 获取任务详情
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const task = await publishService.getTaskById(parseInt(req.params.id, 10), req.user!.userId);
    if (task) {
      successResponse(res, task);
    } else {
      errorResponse(res, 'Task not found', 404);
    }
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// GET /api/publish/:id/stats — 获取某任务各平台的统计数据
router.get('/:id/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const stats = await publishService.getTaskStats(parseInt(req.params.id, 10), req.user!.userId);
    if (stats) {
      successResponse(res, stats);
    } else {
      errorResponse(res, 'Task not found', 404);
    }
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// DELETE /api/publish/:id — 删除任务
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const deleted = await publishService.deleteTask(parseInt(req.params.id, 10), req.user!.userId);
    if (deleted) {
      successResponse(res, null, 'Task deleted');
    } else {
      errorResponse(res, 'Task not found or cannot be deleted', 404);
    }
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});


// POST /api/publish/:id/retry — 重试失败任务
router.post('/:id/retry', authMiddleware, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const task = await publishService.getTaskById(taskId, req.user!.userId);
    if (!task) {
      errorResponse(res, 'Task not found', 404);
      return;
    }
    if (!['failed', 'partial'].includes(task.status)) {
      errorResponse(res, 'Only failed or partial tasks can be retried', 400);
      return;
    }
    await publishService.updateTaskStatus(taskId, 'processing');
    const { publishQueue } = await import('../jobs/publishQueue');
    await publishQueue.add('publish-video', { taskId, userId: req.user!.userId });
    successResponse(res, { id: taskId, status: 'processing' }, 'Task retrying');
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

export default router;

