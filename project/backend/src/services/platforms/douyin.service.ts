import { Pool } from 'pg';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { douyinApiService, DouyinAccessTokenInfo, DouyinUserInfo, DouyinUserVideoListItem } from './douyin.api';

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.username,
  password: config.db.password,
  database: config.db.database,
});

// ==================== \u6296\u97f3\u4e1a\u52a1\u670d\u52a1\u5c42 ====================

export class DouyinService {
  /**
   * \u68c0\u67e5\u662f\u5426\u914d\u7f6e\u4e86\u5b98\u65b9 API
   */
  get isOfficialApiConfigured(): boolean {
    return douyinApiService.isConfigured;
  }

  /**
   * \u83b7\u53d6\u6388\u6743 URL\uff08\u5b98\u65b9 API \u6a21\u5f0f\uff09
   */
  getAuthUrl(userId: number, callbackUrl?: string): { url: string; state: string } {
    const state = userId + '_' + Date.now();
    const redirectUri = callbackUrl || config.platforms.douyin.redirectUri;
    const url = douyinApiService.getAuthPage(redirectUri, state);
    return { url: url, state: state };
  }

  /**
   * \u5904\u7406\u6388\u6743\u56de\u8c03 \u2014\u2014\u7528 code \u6362 token \u5e76\u4fdd\u5b58\u8d26\u53f7
   */
  async handleAuthCallback(code: string, userId: number): Promise<any> {
    // 1. \u7528 code \u6362 token
    const tokenInfo = await douyinApiService.getAccessToken(code);
    const access_token = tokenInfo.access_token;
    const refresh_token = tokenInfo.refresh_token;
    const open_id = tokenInfo.open_id;
    const expires_in = tokenInfo.expires_in;
    const refresh_expires_in = tokenInfo.refresh_expires_in;

    // 2. \u83b7\u53d6\u7528\u6237\u4fe1\u606f
    let userInfo: DouyinUserInfo | null = null;
    try {
      userInfo = await douyinApiService.getUserInfo(access_token, open_id);
    } catch (e: any) {
      logger.warn('[DouyinService] Failed to fetch user info: ' + e.message);
    }

    const nickname = userInfo ? userInfo.nickname : '\u6296\u97f3\u7528\u6237';
    const avatar = userInfo ? userInfo.avatar : '';
    const unionId = userInfo ? userInfo.union_id : '';

    // 3. \u8ba1\u7b97\u8fc7\u671f\u65f6\u95f4
    const accessTokenExpiresAt = new Date(Date.now() + expires_in * 1000);
    const refreshTokenExpiresAt = new Date(Date.now() + (refresh_expires_in || 2592000) * 1000);

    // 4. \u5b58\u5165 platform_accounts
    await pool.query(
      "DELETE FROM platform_accounts WHERE user_id = $1 AND platform = 'douyin' AND platform_user_id = $2",
      [userId, open_id]
    );
    const result = await pool.query(
      "INSERT INTO platform_accounts" +
      " (user_id, platform, platform_user_id, access_token, refresh_token, expires_at, nickname, avatar_url, extra_data, status)" +
      " VALUES ($1, 'douyin', $2, $3, $4, $5, $6, $7, $8, 'active')" +
      " RETURNING *",
      [
        userId,
        open_id,
        access_token,
        refresh_token,
        accessTokenExpiresAt,
        nickname,
        avatar,
        JSON.stringify({
          open_id: open_id,
          union_id: unionId,
          refresh_expires_at: refreshTokenExpiresAt.toISOString(),
          auth_mode: 'official_api',
        }),
      ]
    );

    logger.info('[DouyinService] OAuth callback success: user ' + userId + ' -> ' + nickname + ' (open_id=' + open_id + ')');
    return result.rows[0];
  }

  /**
   * \u786e\u4fdd\u8d26\u53f7\u7684 access_token \u6709\u6548\uff0c\u8fc7\u671f\u5219\u81ea\u52a8\u5237\u65b0
   */
  async ensureAccessToken(accountId: number): Promise<string> {
    const result = await pool.query(
      "SELECT * FROM platform_accounts WHERE id = $1 AND platform = 'douyin'",
      [accountId]
    );
    const account = result.rows[0];
    if (!account) throw new Error('\u6296\u97f3\u8d26\u53f7\u4e0d\u5b58\u5728');

    const extra = typeof account.extra_data === 'string' ? JSON.parse(account.extra_data) : account.extra_data;

    // Cookie \u6a21\u5f0f\u76f4\u63a5\u8fd4\u56de cookie
    if (extra && extra.cookie) {
      return extra.cookie;
    }

    // \u5b98\u65b9 API \u6a21\u5f0f\uff1a\u68c0\u67e5 token \u662f\u5426\u8fc7\u671f
    const now = new Date();
    const expiresAt = account.expires_at ? new Date(account.expires_at) : null;

    if (expiresAt && expiresAt > now) {
      return account.access_token;
    }

    // access_token \u8fc7\u671f\uff0c\u7528 refresh_token \u5237\u65b0
    if (!account.refresh_token) {
      await pool.query("UPDATE platform_accounts SET status = 'expired' WHERE id = $1", [accountId]);
      throw new Error('\u6296\u97f3\u6388\u6743\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u6388\u6743');
    }

    try {
      const refreshed = await douyinApiService.refreshAccessToken(account.refresh_token);
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

      await pool.query(
        "UPDATE platform_accounts" +
        " SET access_token = $1, refresh_token = $2, expires_at = $3, status = 'active', updated_at = NOW()" +
        " WHERE id = ",
        [refreshed.access_token, refreshed.refresh_token, newExpiresAt, accountId]
      );

      logger.info('[DouyinService] Token refreshed for account ' + accountId);
      return refreshed.access_token;
    } catch (error: any) {
      logger.error('[DouyinService] Token refresh failed for account ' + accountId + ':', error.message);
      await pool.query("UPDATE platform_accounts SET status = 'expired' WHERE id = $1", [accountId]);
      throw new Error('\u6296\u97f3\u6388\u6743\u5237\u65b0\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u6388\u6743');
    }
  }

  /**
   * \u68c0\u67e5\u8d26\u53f7\u6388\u6743\u72b6\u6001
   */
  async checkAccountStatus(accountId: number): Promise<{ status: string; expiresAt: Date | null; authMode: string }> {
    const result = await pool.query(
      "SELECT * FROM platform_accounts WHERE id = $1 AND platform = 'douyin'",
      [accountId]
    );
    const account = result.rows[0];
    if (!account) throw new Error('\u6296\u97f3\u8d26\u53f7\u4e0d\u5b58\u5728');

    const extra = typeof account.extra_data === 'string' ? JSON.parse(account.extra_data) : account.extra_data;
    const authMode = extra && extra.auth_mode ? extra.auth_mode : (extra && extra.cookie ? 'cookie' : 'unknown');

    if (authMode === 'cookie') {
      return { status: account.status, expiresAt: null, authMode: 'cookie' };
    }

    const now = new Date();
    const expiresAt = account.expires_at ? new Date(account.expires_at) : null;
    const isExpired = expiresAt ? expiresAt <= now : true;

    if (isExpired && account.refresh_token) {
      try {
        await this.ensureAccessToken(accountId);
        return { status: 'active', expiresAt: null, authMode: 'official_api' };
      } catch (e) {
        return { status: 'expired', expiresAt: expiresAt, authMode: 'official_api' };
      }
    }

    return { status: isExpired ? 'expired' : account.status, expiresAt: expiresAt, authMode: authMode };
  }

  /**
   * \u83b7\u53d6\u7528\u6237\u4f5c\u54c1\u5217\u8868\uff08\u5b98\u65b9 API \u6a21\u5f0f\uff09
   */
  async getUserWorks(accountId: number, cursor: number, count: number): Promise<{
    items: DouyinUserVideoListItem[];
    cursor: number;
    has_more: boolean;
  }> {
    const accessToken = await this.ensureAccessToken(accountId);
    const result = await pool.query(
      "SELECT extra_data FROM platform_accounts WHERE id = $1 AND platform = 'douyin'",
      [accountId]
    );
    const account = result.rows[0];
    if (!account) throw new Error('\u6296\u97f3\u8d26\u53f7\u4e0d\u5b58\u5728');

    const extra = typeof account.extra_data === 'string' ? JSON.parse(account.extra_data) : account.extra_data;

    // Cookie \u6a21\u5f0f\uff1a\u6682\u4e0d\u652f\u6301\u4f5c\u54c1\u5217\u8868
    if (extra && extra.cookie) {
      return { items: [], cursor: 0, has_more: false };
    }

    const openId = (extra && extra.open_id) ? extra.open_id : account.platform_user_id;
    const resp = await douyinApiService.getUserVideoList(accessToken, openId, cursor, count);
    return {
      items: resp.list || [],
      cursor: resp.cursor || 0,
      has_more: resp.has_more || false,
    };
  }

  /**
   * \u83b7\u53d6\u8d26\u53f7\u7edf\u8ba1\u6570\u636e
   */
  async getAccountStats(accountId: number): Promise<{
    total_videos: number;
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_shares: number;
  }> {
    const result = await pool.query(
      "SELECT" +
      " COUNT(DISTINCT vs.platform_video_id) AS total_videos," +
      " COALESCE(SUM(vs.views), 0) AS total_views," +
      " COALESCE(SUM(vs.likes), 0) AS total_likes," +
      " COALESCE(SUM(vs.comments), 0) AS total_comments," +
      " COALESCE(SUM(vs.shares), 0) AS total_shares" +
      " FROM video_stats vs" +
      " JOIN publish_tasks pt ON pt.id = vs.publish_task_id" +
      " JOIN platform_accounts pa ON pa.user_id = pt.user_id AND pa.platform = vs.platform" +
      " WHERE pa.id = $1 AND vs.platform = 'douyin'",
      [accountId]
    );
    const row = result.rows[0];
    return {
      total_videos: parseInt(row.total_videos, 10) || 0,
      total_views: parseInt(row.total_views, 10) || 0,
      total_likes: parseInt(row.total_likes, 10) || 0,
      total_comments: parseInt(row.total_comments, 10) || 0,
      total_shares: parseInt(row.total_shares, 10) || 0,
    };
  }

  /**
   * \u91c7\u96c6\u5355\u4e2a\u89c6\u9891\u7684\u7edf\u8ba1\u6570\u636e
   */
  async collectVideoStats(accountId: number, platformVideoId: string): Promise<{
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }> {
    const accessToken = await this.ensureAccessToken(accountId);
    const result = await pool.query(
      "SELECT extra_data FROM platform_accounts WHERE id = $1 AND platform = 'douyin'",
      [accountId]
    );
    const account = result.rows[0];
    const extra = typeof account.extra_data === 'string' ? JSON.parse(account.extra_data) : account.extra_data;

    // Cookie \u6a21\u5f0f\uff1a\u7528\u73b0\u6709 fetchStats
    if (extra && extra.cookie) {
      const { douyinApiPublisher } = await import('./douyin.api');
      return douyinApiPublisher.fetchStats({ sessionid: '', cookie: extra.cookie }, platformVideoId);
    }

    // \u5b98\u65b9 API \u6a21\u5f0f\uff1a\u83b7\u53d6\u89c6\u9891\u8be6\u60c5
    try {
      const detail = await douyinApiService.getVideoDetail(accessToken, platformVideoId);
      const stat = detail && detail.list && detail.list[0] ? detail.list[0].statistics || {} : {};
      return {
        views: stat.play_count || 0,
        likes: stat.digg_count || 0,
        comments: stat.comment_count || 0,
        shares: stat.share_count || 0,
      };
    } catch (e: any) {
      logger.warn('[DouyinService] Failed to collect stats for ' + platformVideoId + ': ' + e.message);
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }
  }
}

export const douyinService = new DouyinService();

