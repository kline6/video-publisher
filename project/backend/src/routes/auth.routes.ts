import { Router as ExpressRouter, Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { successResponse, errorResponse } from '../utils/response';

const router: ExpressRouter = ExpressRouter();

const registerSchema = z.object({
  body: z.object({
    username: z.string().min(3).max(50),
    email: z.string().email(),
    password: z.string().min(6).max(100),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string(),
  }),
});

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const result = await authService.register(req.body);
    successResponse(res, result, 'Registration successful', 201);
  } catch (error: any) {
    errorResponse(res, error.message, 400);
  }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const result = await authService.login(req.body);
    successResponse(res, result, 'Login successful');
  } catch (error: any) {
    errorResponse(res, error.message, 401);
  }
});

// GET /api/auth/profile
router.get('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const profile = await authService.getProfile(req.user!.userId);
    successResponse(res, profile);
  } catch (error: any) {
    errorResponse(res, error.message, 400);
  }
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const profile = await authService.updateProfile(req.user!.userId, req.body);
    successResponse(res, profile, 'Profile updated');
  } catch (error: any) {
    errorResponse(res, error.message, 400);
  }
});

export default router;
