import { Router as ExpressRouter, Request, Response } from "express";
import { z } from "zod";
import { aiService } from "../services/ai.service";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { successResponse, errorResponse } from "../utils/response";

const router: ExpressRouter = ExpressRouter();

const scriptSchema = z.object({
  body: z.object({
    topic: z.string().min(1),
    style: z.enum(["educational", "story", "fast-paced"]),
    duration: z.number().optional(),
    platform: z.enum(["douyin", "bilibili", "youtube", "kuaishou", "weixin", "tiktok"]).optional(),
    model: z.string().optional(),
  }),
});

const titleSchema = z.object({
  body: z.object({
    topic: z.string().min(1),
    style: z.string().optional(),
    count: z.number().min(1).max(10).optional(),
    platform: z.enum(["douyin", "bilibili", "youtube", "kuaishou", "weixin", "tiktok"]).optional(),
    model: z.string().optional(),
  }),
});

const tagsSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    platform: z.enum(["douyin", "bilibili", "youtube", "kuaishou", "weixin", "tiktok"]).optional(),
    model: z.string().optional(),
  }),
});

// POST /api/ai/generate-script
router.post("/generate-script", authMiddleware, validate(scriptSchema), async (req: Request, res: Response) => {
  try {
    const result = await aiService.generateScript(req.user!.userId, req.body, req.body.model);
    successResponse(res, result);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// POST /api/ai/generate-titles
router.post("/generate-titles", authMiddleware, validate(titleSchema), async (req: Request, res: Response) => {
  try {
    const titles = await aiService.generateTitles(req.user!.userId, req.body, req.body.model);
    successResponse(res, { titles });
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// POST /api/ai/generate-tags
router.post("/generate-tags", authMiddleware, validate(tagsSchema), async (req: Request, res: Response) => {
  try {
    const tags = await aiService.generateTags(req.user!.userId, req.body, req.body.model);
    successResponse(res, { tags });
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// POST /api/ai/generate-description
router.post("/generate-description", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { topic, platform, model } = req.body;
    const description = await aiService.generateDescription(req.user!.userId, topic, platform, model);
    successResponse(res, { description });
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// POST /api/ai/generate-cover-prompt
router.post("/generate-cover-prompt", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { topic, style, model } = req.body;
    const prompt = await aiService.generateCoverPrompt(req.user!.userId, topic, style, model);
    successResponse(res, { prompt });
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// POST /api/ai/optimize-topic
router.post("/optimize-topic", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { keywords, platform, model } = req.body;
    if (!keywords || !keywords.trim()) {
      errorResponse(res, "请提供关键词", 400);
      return;
    }
    const topics = await aiService.optimizeTopic(req.user!.userId, keywords.trim(), platform, model);
    successResponse(res, { topics });
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

// GET /api/ai/history
router.get("/history", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const history = await aiService.getHistory(req.user!.userId, type as string);
    successResponse(res, history);
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

export default router;
