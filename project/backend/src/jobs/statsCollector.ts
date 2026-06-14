import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.username,
  password: config.db.password,
  database: config.db.database,
});

let collectorInterval: NodeJS.Timeout | null = null;

async function collectDouyinStats(): Promise<void> {
  try {
    const accountsResult = await pool.query(
      "SELECT id, user_id, extra_data FROM platform_accounts WHERE platform = 'douyin' AND status = 'active'"
    );

    if (accountsResult.rows.length === 0) {
      logger.debug('[StatsCollector] No active Douyin accounts found');
      return;
    }

    logger.info('[StatsCollector] Collecting stats for ' + accountsResult.rows.length + ' Douyin accounts');

    const { douyinService } = await import('../services/platforms/douyin.service');

    for (const account of accountsResult.rows) {
      try {
        const videosResult = await pool.query(
          'SELECT DISTINCT vs.platform_video_id, vs.publish_task_id' +
          ' FROM video_stats vs' +
          ' JOIN publish_tasks pt ON pt.id = vs.publish_task_id' +
          " WHERE pt.user_id = $1 AND vs.platform = 'douyin'" +
          " AND vs.platform_video_id IS NOT NULL AND vs.platform_video_id != ''",
          [account.user_id]
        );

        for (const video of videosResult.rows) {
          try {
            const stats = await douyinService.collectVideoStats(account.id, video.platform_video_id);

            const latestResult = await pool.query(
              'SELECT views, likes, comments, shares FROM video_stats' +
              " WHERE platform = 'douyin' AND platform_video_id = $1 AND publish_task_id = $2" +
              ' ORDER BY collected_at DESC LIMIT 1',
              [video.platform_video_id, video.publish_task_id]
            );
            const latest = latestResult.rows[0];
            const hasChanged = !latest
              || latest.views !== stats.views
              || latest.likes !== stats.likes
              || latest.comments !== stats.comments
              || latest.shares !== stats.shares;

            if (hasChanged) {
              await pool.query(
                "INSERT INTO video_stats (platform, platform_video_id, publish_task_id, views, likes, comments, shares, collected_at)" +
                " VALUES ('douyin', $1, $2, $3, $4, $5, $6, NOW())",
                [video.platform_video_id, video.publish_task_id, stats.views, stats.likes, stats.comments, stats.shares]
              );
            }
          } catch (e: any) {
            logger.warn('[StatsCollector] Failed to collect for video ' + video.platform_video_id + ': ' + e.message);
          }
        }

        logger.info('[StatsCollector] Douyin stats collected for account ' + account.id);
      } catch (e: any) {
        logger.error('[StatsCollector] Failed for account ' + account.id + ': ' + e.message);
      }
    }
  } catch (e: any) {
    logger.error('[StatsCollector] Collection cycle failed:', e.message);
  }
}

export function startStatsCollector(): void {
  if (collectorInterval) return;

  const intervalMs = parseInt(process.env.STATS_COLLECTOR_INTERVAL_MS || '', 10) || 30 * 60 * 1000;

  setTimeout(collectDouyinStats, 30 * 1000);

  collectorInterval = setInterval(collectDouyinStats, intervalMs);
  logger.info('[StatsCollector] Started with interval ' + (intervalMs / 1000) + 's');
}

export function stopStatsCollector(): void {
  if (collectorInterval) {
    clearInterval(collectorInterval);
    collectorInterval = null;
    logger.info('[StatsCollector] Stopped');
  }
}
