import { Router as ExpressRouter, Request, Response } from 'express';
import { calendarService } from '../services/calendar.service';
import { authMiddleware } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';

const router: ExpressRouter = ExpressRouter();

// GET /api/calendar — 获取日历事件
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      errorResponse(res, 'start_date and end_date are required');
      return;
    }
    const events = await calendarService.getEvents(
      req.user!.userId,
      start_date as string,
      end_date as string
    );
    successResponse(res, events);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// POST /api/calendar — 创建日历事件
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const event = await calendarService.createEvent(req.user!.userId, req.body);
    successResponse(res, event, 'Event created', 201);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// PUT /api/calendar/:id — 更新日历事件
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const event = await calendarService.updateEvent(
      parseInt(req.params.id, 10),
      req.user!.userId,
      req.body
    );
    if (event) {
      successResponse(res, event, 'Event updated');
    } else {
      errorResponse(res, 'Event not found', 404);
    }
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// DELETE /api/calendar/:id — 删除日历事件
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const deleted = await calendarService.deleteEvent(parseInt(req.params.id, 10), req.user!.userId);
    if (deleted) {
      successResponse(res, null, 'Event deleted');
    } else {
      errorResponse(res, 'Event not found', 404);
    }
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

export default router;
