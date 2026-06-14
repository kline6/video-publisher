import { Pool } from 'pg';
import { config } from '../config';
import { PublishTask, CreatePublishTaskDTO, TaskStatus, PublishResult, Platform } from '../types';
import { logger } from '../utils/logger';
import { publishQueue } from '../jobs/publishQueue';
import { bilibiliPublisher } from './platforms/bilibili.pub';
import { douyinApiPublisher } from './platforms/douyin.api';

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.username,
  password: config.db.password,
  database: config.db.database,
});

export class PublishService {
  async createTask(userId: number, data: CreatePublishTaskDTO): Promise<PublishTask> {
    const result = await pool.query(
      "INSERT INTO publish_tasks (user_id, title, description, tags, video_url, cover_url, platforms, status, scheduled_at)" +
      " VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
      [userId, data.title, data.description || null, data.tags || [], data.video_url || null, data.cover_url || null, data.platforms, data.scheduled_at ? 'scheduled' : 'pending', data.scheduled_at ? new Date(data.scheduled_at) : null]
    );
    const task = result.rows[0];
    if (!data.scheduled_at) {
      await publishQueue.add('publish-video', { taskId: task.id, userId: userId });
      await pool.query("UPDATE publish_tasks SET status = 'processing' WHERE id = $1", [task.id]);
      task.status = 'processing';
    }
    return task;
  }

  async getTasks(userId: number, options: { page?: number; limit?: number; status?: TaskStatus } = {}): Promise<{ tasks: PublishTask[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const status = options.status;
    const offset = (page - 1) * limit;
    let where = 'WHERE user_id = $1';
    const params: any[] = [userId];
    if (status) {
      params.push(status);
      where += ' AND status = $' + params.length;
    }
    const count = await pool.query('SELECT COUNT(*) FROM publish_tasks ' + where, params);
    params.push(limit);
    params.push(offset);
    const tasks = await pool.query(
      'SELECT * FROM publish_tasks ' + where + ' ORDER BY created_at DESC LIMIT $' + (params.length - 1) + ' OFFSET $' + params.length,
      params
    );
    return { tasks: tasks.rows, total: parseInt(count.rows[0].count, 10) };
  }

  async getTaskById(taskId: number, userId: number): Promise<PublishTask | null> {
    const result = await pool.query('SELECT * FROM publish_tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);
    return result.rows[0] || null;
  }

  async updateTaskStatus(taskId: number, status: TaskStatus, errorMessage?: string): Promise<void> {
    const updates: string[] = ['status = $1', 'updated_at = NOW()'];
    const params: any[] = [status];
    if (status === 'success' || status === 'partial') {
      updates.push('published_at = NOW()');
    }
    if (errorMessage) {
      params.push(errorMessage);
      updates.push('error_message = $' + params.length);
    }
    params.push(taskId);
    await pool.query('UPDATE publish_tasks SET ' + updates.join(', ') + ' WHERE id = $' + params.length, params);
  }

  async addPublishResult(taskId: number, result: PublishResult): Promise<void> {
    await pool.query(
      "UPDATE publish_tasks SET publish_results = publish_results || $1::jsonb, updated_at = NOW() WHERE id = $2",
      [JSON.stringify([result]), taskId]
    );
  }

  async deleteTask(taskId: number, userId: number): Promise<boolean> {
    const result = await pool.query(
      "DELETE FROM publish_tasks WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'scheduled', 'failed')",
      [taskId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getScheduledTasks(): Promise<PublishTask[]> {
    const result = await pool.query(
      "SELECT * FROM publish_tasks WHERE status = 'scheduled' AND scheduled_at <= NOW() ORDER BY scheduled_at ASC"
    );
    return result.rows;
  }

  async batchPublish(taskId: number): Promise<void> {
    const taskResult = await pool.query('SELECT * FROM publish_tasks WHERE id = $1', [taskId]);
    const task = taskResult.rows[0];
    if (!task) throw new Error('Task not found');
    await this.updateTaskStatus(taskId, 'publishing');
    const results: PublishResult[] = [];

    for (const platform of task.platforms) {
      try {
        // \u67e5\u8be2\u8be5\u7528\u6237\u5728\u8be5\u5e73\u53f0\u662f\u5426\u6709\u771f\u5b9e\u7ed1\u5b9a\u8d26\u53f7
        const accountResult = await pool.query(
          "SELECT * FROM platform_accounts WHERE user_id = $1 AND platform = $2 AND status = 'active'",
          [task.user_id, platform]
        );
        const account = accountResult.rows[0];

        if (!account) {
          results.push({ platform: platform, status: 'failed', error: '\u672a\u7ed1\u5b9a ' + platform + ' \u8d26\u53f7\uff0c\u8bf7\u5148\u5728\u300c\u8d26\u53f7\u7ba1\u7406\u300d\u4e2d\u7ed1\u5b9a' });
          continue;
        }

        const extra = typeof account.extra_data === 'string' ? JSON.parse(account.extra_data) : account.extra_data;

        // ===== \u6296\u97f3\u53d1\u5e03 =====
        if (platform === 'douyin') {
          if (extra && extra.cookie) {
            // Cookie \u6a21\u5f0f\u53d1\u5e03\uff08\u73b0\u6709\u903b\u8f91\uff09
            logger.info('[Publish] Douyin cookie publish: task ' + taskId);
            const pubResult = await douyinApiPublisher.publish(
              { sessionid: extra.sessionid || '', cookie: extra.cookie, tokens: extra.tokens, storageStatePath: extra.storageStatePath },
              {
                title: task.title,
                description: task.description || '',
                videoPath: task.video_url || '',
                coverPath: task.cover_url || undefined,
                tags: task.tags || [],
              }
            );

            if (pubResult.success) {
              results.push({
                platform: platform, status: 'success',
                platform_video_id: pubResult.platform_video_id,
                published_at: new Date().toISOString(),
              });
              await pool.query(
                "INSERT INTO video_stats (platform, platform_video_id, publish_task_id, views, likes, comments, shares)" +
                " VALUES ($1, $2, $3, 0, 0, 0, 0)",
                [platform, pubResult.platform_video_id, taskId]
              );
            } else {
              results.push({ platform: platform, status: 'failed', error: pubResult.error });
            }
          } else if (extra && extra.open_id) {
            // \u5b98\u65b9 API \u6a21\u5f0f\uff1a\u7528 share schema \u5f15\u5bfc\u7528\u6237\u5728\u7aef\u5185\u53d1\u5e03
            logger.info('[Publish] Douyin official API mode: task ' + taskId);
            try {
              const { platformService } = await import('./platform.service');
              await platformService.ensureDouyinAccessToken(account.id);
              // \u5b98\u65b9 API \u76ee\u524d\u4e0d\u652f\u6301\u76f4\u63a5\u670d\u52a1\u7aef\u4e0a\u4f20\u89c6\u9891\uff0c\u901a\u8fc7 share schema \u5f15\u5bfc\u53d1\u5e03
              results.push({
                platform: platform, status: 'failed',
                error: '\u5b98\u65b9 API \u6a21\u5f0f\u6682\u4e0d\u652f\u6301\u670d\u52a1\u7aef\u76f4\u63a5\u53d1\u5e03\uff0c\u8bf7\u4f7f\u7528 Cookie \u7ed1\u5b9a\u65b9\u5f0f\u53d1\u5e03',
              });
            } catch (e: any) {
              results.push({ platform: platform, status: 'failed', error: '\u5b98\u65b9 API token \u5f02\u5e38: ' + e.message });
            }
          } else {
            results.push({ platform: platform, status: 'failed', error: '\u6296\u97f3\u8d26\u53f7\u6570\u636e\u4e0d\u5b8c\u6574\uff0c\u8bf7\u91cd\u65b0\u7ed1\u5b9a' });
          }
        }
        // ===== B\u7ad9\u53d1\u5e03 =====
        else if (platform === 'bilibili' && extra && extra.sessdata && extra.bili_jct) {
          logger.info('[Publish] Bilibili real publish: task ' + taskId);
          const pubResult = await bilibiliPublisher.publish(
            { sessdata: extra.sessdata, bili_jct: extra.bili_jct, dedeuserid: extra.dedeuserid || account.platform_user_id },
            {
              title: task.title,
              description: task.description || '',
              videoPath: task.video_url || '',
              coverPath: task.cover_url || undefined,
              tags: task.tags || [],
            }
          );

          if (pubResult.success) {
            results.push({
              platform: platform,
              status: 'success',
              platform_video_id: pubResult.platform_video_id,
              published_at: new Date().toISOString(),
            });
            await pool.query(
              "INSERT INTO video_stats (platform, platform_video_id, publish_task_id, views, likes, comments, shares)" +
              " VALUES ($1, $2, $3, 0, 0, 0, 0)",
              [platform, pubResult.platform_video_id, taskId]
            );
          } else {
            results.push({ platform: platform, status: 'failed', error: pubResult.error });
          }
        } else if (platform === 'bilibili') {
          results.push({ platform: platform, status: 'failed', error: 'B\u7ad9\u8d26\u53f7 Cookie \u4e0d\u5b8c\u6574\uff0c\u8bf7\u91cd\u65b0\u7ed1\u5b9a' });
        } else {
          results.push({ platform: platform, status: 'failed', error: platform + ' \u5e73\u53f0\u53d1\u5e03\u529f\u80fd\u5f00\u53d1\u4e2d' });
        }
      } catch (error: any) {
        logger.error('Failed to publish to ' + platform + ':', error);
        results.push({ platform: platform, status: 'failed', error: error.message });
      }
    }

    const allSuccess = results.every(function(r) { return r.status === 'success'; });
    const allFailed = results.every(function(r) { return r.status === 'failed'; });
    const finalStatus = allSuccess ? 'success' : (allFailed ? 'failed' : 'partial');
    const errorMsg = allFailed ? results.map(function(r) { return r.platform + ': ' + r.error; }).join('; ') : undefined;
    await this.updateTaskStatus(taskId, finalStatus, errorMsg);
    for (let i = 0; i < results.length; i++) {
      await this.addPublishResult(taskId, results[i]);
    }
  }

  async getTaskStats(taskId: number, userId: number): Promise<any | null> {
    const taskResult = await pool.query('SELECT * FROM publish_tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);
    const task = taskResult.rows[0];
    if (!task) return null;

    const statsResult = await pool.query(
      "SELECT vs.platform, vs.platform_video_id, vs.views, vs.likes, vs.comments, vs.shares, vs.collected_at" +
      " FROM video_stats vs WHERE vs.publish_task_id = $1 ORDER BY vs.collected_at DESC",
      [taskId]
    );

    const latestByPlatform: Record<string, any> = {};
    for (const row of statsResult.rows) {
      if (!latestByPlatform[row.platform]) {
        latestByPlatform[row.platform] = {
          platform: row.platform, platform_video_id: row.platform_video_id,
          views: parseInt(row.views, 10) || 0, likes: parseInt(row.likes, 10) || 0,
          comments: parseInt(row.comments, 10) || 0, shares: parseInt(row.shares, 10) || 0,
          collected_at: row.collected_at,
        };
      }
    }

    const platformStats = Object.values(latestByPlatform);
    return { task_id: taskId, title: task.title, status: task.status, stats: platformStats };
  }
}

export const publishService = new PublishService();






