import { config } from './config';
import { testConnection } from './config/database';
import { runMigrations } from './config/migrate';
import { setupQueues } from './jobs/publishQueue';
import { logger } from './utils/logger';

async function bootstrap() {
  logger.info('Starting VideoFlow Backend...');
  logger.info(`Environment: ${config.env}`);

  // 1. 测试数据库连接
  await testConnection();

  // 2. 运行数据库迁移
  logger.info('Running database migrations...');
  await runMigrations();

  // 3. 初始化任务队列
  setupQueues();

  // 4. 导入并启动 Express（在迁移完成后）
  const { createApp } = await import('./app');
  const app = createApp();

  app.listen(config.port, () => {
    logger.info(`VideoFlow Backend running on port ${config.port}`);
    logger.info(`Frontend URL: ${config.frontendUrl}`);
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});
