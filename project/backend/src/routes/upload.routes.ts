import { Router as ExpressRouter, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';

const storage = multer.diskStorage({
  destination: './uploads',
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm'];
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (videoExts.includes(ext) || imageExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式: ' + ext));
    }
  },
});

const router: ExpressRouter = ExpressRouter();

router.post('/', authMiddleware, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      errorResponse(res, '请选择文件', 400);
      return;
    }
    const fileUrl = '/uploads/' + req.file.filename;
    const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm'].includes(
      path.extname(req.file.originalname).toLowerCase()
    );
    successResponse(res, {
      url: fileUrl,
      filename: req.file.originalname,
      size: req.file.size,
      type: isVideo ? 'video' : 'image',
    }, '上传成功');
  } catch (error: any) {
    errorResponse(res, error.message);
  }
});

export default router;
