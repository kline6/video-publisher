import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';

// Routes
import authRoutes from './routes/auth.routes';
import platformRoutes from './routes/platform.routes';
import publishRoutes from './routes/publish.routes';
import trafficRoutes from './routes/traffic.routes';
import aiRoutes from './routes/ai.routes';
import calendarRoutes from './routes/calendar.routes';
import settingsRoutes from './routes/settings.routes';
import uploadRoutes from './routes/upload.routes';
import douyinRoutes from './routes/douyin.routes';

export function createApp(): express.Application {
  const app = express();

  // ===== \u4e2d\u95f4\u4ef6 =====
  app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(requestLogger);

  // ===== \u9759\u6001\u6587\u4ef6 =====
  app.use('/uploads', express.static(path.resolve(config.upload.dir)));

  // ===== \u5065\u5eb7\u68c0\u67e5 =====
  app.get('/api/health', function(_req, res) {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ===== API \u8def\u7531 =====
  app.use('/api/auth', authRoutes);
  app.use('/api/platforms', platformRoutes);
  app.use('/api/publish', publishRoutes);
  app.use('/api/traffic', trafficRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/calendar', calendarRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/douyin', douyinRoutes);

  // ===== 404 =====
  app.use('/api/*', function(_req, res) {
    res.status(404).json({ success: false, error: 'API endpoint not found' });
  });

  // ===== \u9519\u8bef\u5904\u7406 =====
  app.use(errorHandler);

  return app;
}
