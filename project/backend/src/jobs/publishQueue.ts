import { logger } from '../utils/logger';

interface PublishJobData {
  taskId: number;
  userId: number;
}

class SimpleQueue {
  private handlers = new Map<string, (data: any) => Promise<void>>();

  process(jobName: string, handler: (data: any) => Promise<void>) {
    this.handlers.set(jobName, handler);
  }

  async add(jobName: string, data: PublishJobData) {
    logger.info('Job queued: ' + jobName + ' for task ' + data.taskId);
    const handler = this.handlers.get(jobName);
    if (handler) {
      setImmediate(async function() {
        try {
          await handler(data);
          logger.info('Job completed: ' + jobName + ' for task ' + data.taskId);
        } catch (error) {
          logger.error('Job failed: ' + jobName + ' for task ' + data.taskId + ':', error);
        }
      });
    }
  }
}

export const publishQueue = new SimpleQueue();

publishQueue.process('publish-video', async function(data: PublishJobData) {
  const taskId = data.taskId;
  const userId = data.userId;
  logger.info('Processing publish task ' + taskId + ' for user ' + userId);
  const { publishService } = await import('../services/publish.service');
  try {
    await publishService.batchPublish(taskId);
    logger.info('Publish task ' + taskId + ' completed');
  } catch (error: any) {
    logger.error('Publish task ' + taskId + ' failed:', error);
    await publishService.updateTaskStatus(taskId, 'failed', error.message);
    throw error;
  }
});

let schedulerInterval: NodeJS.Timeout | null = null;

function startScheduler() {
  if (schedulerInterval) return;
  schedulerInterval = setInterval(async function() {
    try {
      const { publishService } = await import('../services/publish.service');
      const tasks = await publishService.getScheduledTasks();
      for (const task of tasks) {
        logger.info('Dispatching scheduled task ' + task.id);
        await publishService.updateTaskStatus(task.id, 'processing');
        await publishQueue.add('publish-video', { taskId: task.id, userId: task.user_id });
      }
    } catch (error) {
      logger.error('Scheduler check failed:', error);
    }
  }, 60000);
}

let tokenRefreshInterval: NodeJS.Timeout | null = null;

function startTokenRefreshScheduler() {
  if (tokenRefreshInterval) return;
  tokenRefreshInterval = setInterval(async function() {
    try {
      const { platformService } = await import('../services/platform.service');
      await platformService.refreshExpiringTokens();
    } catch (error) {
      logger.error('Token refresh scheduler failed:', error);
    }
  }, 30 * 60 * 1000);
}

export function setupQueues(): void {
  startScheduler();
  startTokenRefreshScheduler();
  try {
    const { startStatsCollector } = require('./statsCollector');
    startStatsCollector();
  } catch (error) {
    logger.warn('Stats collector failed to start:', error);
  }
  logger.info('Task queues initialized (in-memory mode)');
}
