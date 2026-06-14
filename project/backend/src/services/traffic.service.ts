import { Pool } from 'pg';
import { config } from '../config';
import { HotTopic, TrafficSuggestion, Platform, DashboardStats, VideoStats } from '../types';
import { getCache, setCache } from '../config/redis';
import { logger } from '../utils/logger';

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.username,
  password: config.db.password,
  database: config.db.database,
});

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function safeFetch(url: string, options?: RequestInit): Promise<any | null> {
  try {
    const resp = await fetch(url, {
      ...options,
      headers: { 'User-Agent': UA, ...(options?.headers || {}) },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e: any) {
    logger.warn(`Fetch failed for ${url}: ${e.message}`);
    return null;
  }
}

// ==================== 真实爬虫 ====================

async function fetchBilibiliHot(): Promise<Array<{ title: string; heat: number; url: string; category: string }>> {
  // B站热搜词条
  const data = await safeFetch('https://app.bilibili.com/x/v2/search/trending/ranking');
  if (data?.data?.list) {
    return data.data.list.map((item: any) => ({
      title: item.keyword || item.show_name || '',
      heat: item.hot_id || item.score || 0,
      url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(item.keyword || '')}`,
      category: '综合',
    }));
  }

  // 备用: B站热门视频排行
  const rank = await safeFetch('https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all');
  if (rank?.data?.list) {
    return rank.data.list.slice(0, 20).map((item: any) => ({
      title: item.title || '',
      heat: item.stat?.view || 0,
      url: `https://www.bilibili.com/video/${item.bvid}`,
      category: '热门视频',
    }));
  }

  return [];
}

async function fetchDouyinHot(): Promise<Array<{ title: string; heat: number; url: string; category: string }>> {
  // 抖音热搜 - 尝试多个公开 API
  const data = await safeFetch('https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/');
  if (data?.word_list || data?.data) {
    const list = data.word_list || data.data || [];
    return list.map((item: any) => ({
      title: item.word || item.title || '',
      heat: item.hot_value || item.search_count || 0,
      url: `https://www.douyin.com/search/${encodeURIComponent(item.word || item.title || '')}`,
      category: item.label?.toString() || '热搜',
    }));
  }

  // 备用聚合源
  const alt = await safeFetch('https://api.vvhan.com/api/hotlist/douyinHot');
  if (alt?.data) {
    return (alt.data || []).map((item: any) => ({
      title: item.title || item.desc || '',
      heat: item.hot || item.index || 0,
      url: item.url || '',
      category: '抖音热搜',
    }));
  }

  return [];
}

async function fetchWeiboHot(): Promise<Array<{ title: string; heat: number; url: string; category: string }>> {
  // 微博热搜
  const data = await safeFetch('https://weibo.com/ajax/side/hotSearch');
  if (data?.data?.realtime) {
    return data.data.realtime.map((item: any) => ({
      title: item.note || item.word || '',
      heat: item.num || item.raw_hot || 0,
      url: `https://s.weibo.com/weibo?q=${encodeURIComponent(item.note || item.word || '')}`,
      category: item.category || '热搜',
    }));
  }
  return [];
}

async function fetchKuaishouHot(): Promise<Array<{ title: string; heat: number; url: string; category: string }>> {
  // 快手热搜 - 聚合源
  const data = await safeFetch('https://api.vvhan.com/api/hotlist/ksHot');
  if (data?.data) {
    return (data.data || []).map((item: any) => ({
      title: item.title || item.desc || '',
      heat: item.hot || item.index || 0,
      url: item.url || '',
      category: '快手热搜',
    }));
  }
  return [];
}

async function fetchToutiaoHot(): Promise<Array<{ title: string; heat: number; url: string; category: string }>> {
  const data = await safeFetch('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc');
  if (data?.data) {
    return (data.data || []).map((item: any) => ({
      title: item.Title || '',
      heat: item.HotValue || 0,
      url: item.Url || '',
      category: '头条热搜',
    }));
  }
  return [];
}

// ==================== Service ====================

export class TrafficService {
  private getMockHotTopics(platform?: string, limit = 50): HotTopic[] {
    const now = new Date();
    const topics: Array<{ platform: Platform; title: string; heat_value: number; category: string }> = [
      { platform: 'douyin', title: '如何用AI工具提高工作效率', heat_value: 9850, category: '科技' },
      { platform: 'douyin', title: '2026年最值得去的10个旅行目的地', heat_value: 9200, category: '旅行' },
      { platform: 'douyin', title: '普通人如何开始短视频创作', heat_value: 8700, category: '教程' },
      { platform: 'douyin', title: '夏天必吃的5道家常凉菜', heat_value: 8200, category: '美食' },
      { platform: 'bilibili', title: 'AI绘画入门教程：零基础也能画出大作', heat_value: 9100, category: '科技' },
      { platform: 'bilibili', title: 'UP主收入揭秘：做到这些月入过万', heat_value: 8600, category: '自媒体' },
      { platform: 'bilibili', title: '2026年最火番剧推荐TOP10', heat_value: 8300, category: '动漫' },
      { platform: 'kuaishou', title: '农村小伙靠自媒体年入百万的真实经历', heat_value: 8800, category: '生活' },
      { platform: 'kuaishou', title: '新手摆摊创业必看的避坑指南', heat_value: 8400, category: '创业' },
    ];

    let filtered = topics;
    if (platform) filtered = topics.filter(t => t.platform === platform);
    filtered.sort((a, b) => b.heat_value - a.heat_value);

    return filtered.slice(0, limit).map((t, index) => ({
      id: index + 1,
      platform: t.platform,
      title: t.title,
      heat_value: t.heat_value,
      category: t.category,
      fetched_at: now,
    }));
  }



  async getHotTopics(platform?: string, limit = 50): Promise<HotTopic[]> {
    const cacheKey = `hot_topics:${platform || 'all'}`;
    const cached = await getCache<HotTopic[]>(cacheKey);
    if (cached && cached.length > 0) return cached.slice(0, limit);

    // 读数据库中15分钟内的数据
    let query = 'SELECT * FROM hot_topics WHERE fetched_at > NOW() - INTERVAL \'15 minutes\'';
    const params: any[] = [];
    if (platform) {
      query += ' AND platform = $1';
      params.push(platform);
    }
    query += ' ORDER BY heat_value DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await pool.query(query, params);
    if (result.rows.length > 0) {
      await setCache(cacheKey, result.rows, 300);
      return result.rows;
    }

    // 无缓存且无新鲜数据 → 返回模拟数据
    return this.getMockHotTopics(platform, limit);
  }

  async refreshHotTopics(): Promise<void> {
    logger.info('Refreshing hot topics from all platforms...');

    // 并行爬取所有平台
    const [bilibiliHot, douyinHot, weiboHot, kuaishouHot, toutiaoHot] = await Promise.all([
      fetchBilibiliHot(),
      fetchDouyinHot(),
      fetchWeiboHot(),
      fetchKuaishouHot(),
      fetchToutiaoHot(),
    ]);

    const allTopics: Array<{ platform: string; title: string; heat: number; url: string; category: string }> = [
      ...bilibiliHot.map(t => ({ ...t, platform: 'bilibili' })),
      ...douyinHot.map(t => ({ ...t, platform: 'douyin' })),
      ...weiboHot.map(t => ({ ...t, platform: 'weibo' as any })),
      ...kuaishouHot.map(t => ({ ...t, platform: 'kuaishou' })),
      ...toutiaoHot.map(t => ({ ...t, platform: 'toutiao' as any })),
    ];

    if (allTopics.length === 0) {
      logger.warn('No hot topics fetched from any platform, keeping existing data');
      return;
    }

    // 清除旧缓存
    await pool.query('DELETE FROM hot_topics WHERE fetched_at < NOW() - INTERVAL \'1 hour\'');

    // 批量插入
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const topic of allTopics) {
        await client.query(
          `INSERT INTO hot_topics (platform, title, url, heat_value, category, fetched_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT DO NOTHING`,
          [topic.platform, topic.title, topic.url || '', topic.heat || 0, topic.category || '']
        );
      }
      await client.query('COMMIT');
      logger.info(`Inserted ${allTopics.length} hot topics`);
    } catch (e) {
      await client.query('ROLLBACK');
      logger.error('Failed to insert hot topics:', e);
    } finally {
      client.release();
    }

    // 清除 Redis 缓存
    await setCache('hot_topics:all', null, 0);
    await setCache('hot_topics:douyin', null, 0);
    await setCache('hot_topics:bilibili', null, 0);
    await setCache('hot_topics:kuaishou', null, 0);
  }

  async getBestTime(userId: number, platform?: string): Promise<any[]> {
    return this.getDefaultBestTime();
  }

  async competitorAnalysis(platform?: string, keywords?: string[]): Promise<any> {
    return { message: '竞品分析功能开发中', keywords, platform };
  }

  async getSuggestionHistory(userId: number, type?: string): Promise<TrafficSuggestion[]> {
    let query = 'SELECT * FROM traffic_suggestions WHERE user_id = $1';
    const params: any[] = [userId];
    if (type) { query += ' AND type = $2'; params.push(type); }
    query += ' ORDER BY created_at DESC LIMIT 50';
    const result = await pool.query(query, params);
    return result.rows;
  }

  async getDashboard(userId: number): Promise<DashboardStats> {
    const cacheKey = `dashboard:${userId}`;
    const cached = await getCache<DashboardStats>(cacheKey);
    if (cached) return cached;

    const totalResult = await pool.query(
      `SELECT COUNT(DISTINCT pt.id) AS total_videos,
              COALESCE(SUM(vs.views), 0) AS total_views,
              COALESCE(SUM(vs.likes), 0) AS total_likes
       FROM publish_tasks pt
       LEFT JOIN video_stats vs ON vs.publish_task_id = pt.id
       WHERE pt.user_id = $1 AND pt.status = 'success'`,
      [userId]
    );

    const platformResult = await pool.query(
      `SELECT vs.platform, COUNT(DISTINCT vs.publish_task_id) AS videos,
              COALESCE(SUM(vs.views), 0) AS views, COALESCE(SUM(vs.likes), 0) AS likes
       FROM video_stats vs JOIN publish_tasks pt ON pt.id = vs.publish_task_id
       WHERE pt.user_id = $1 GROUP BY vs.platform`,
      [userId]
    );

    const trendResult = await pool.query(
      `SELECT DATE(vs.collected_at) AS date, SUM(vs.views) AS views, SUM(vs.likes) AS likes
       FROM video_stats vs JOIN publish_tasks pt ON pt.id = vs.publish_task_id
       WHERE pt.user_id = $1 AND vs.collected_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(vs.collected_at) ORDER BY date ASC`,
      [userId]
    );

    const totals = totalResult.rows[0];
    const platformBreakdown: Record<string, any> = {};
    for (const row of platformResult.rows) {
      platformBreakdown[row.platform] = {
        videos: parseInt(row.videos, 10), views: parseInt(row.views, 10), likes: parseInt(row.likes, 10),
      };
    }

    const dashboard: DashboardStats = {
      total_videos: parseInt(totals.total_videos, 10),
      total_views: parseInt(totals.total_views, 10),
      total_likes: parseInt(totals.total_likes, 10),
      total_followers: 0,
      platform_breakdown: platformBreakdown as any,
      trend_data: trendResult.rows.map((r: any) => ({
        date: r.date, views: parseInt(r.views, 10), likes: parseInt(r.likes, 10),
      })),
    };

    if (dashboard.total_videos === 0 && dashboard.total_views === 0) { return dashboard; }

    await setCache(cacheKey, dashboard, 600);
    return dashboard;
  }

  private getDefaultBestTime() {
    return [
      { day_of_week: 1, hour: 12, avg_views: 8500, avg_likes: 620, sample_count: 120, label: '周一 12:00 午间高峰' },
      { day_of_week: 1, hour: 20, avg_views: 11200, avg_likes: 850, sample_count: 145, label: '周一 20:00 晚间黄金档' },
      { day_of_week: 2, hour: 19, avg_views: 9800, avg_likes: 710, sample_count: 130, label: '周二 19:00 晚间活跃期' },
      { day_of_week: 3, hour: 12, avg_views: 7600, avg_likes: 530, sample_count: 110, label: '周三 12:00 午休时段' },
      { day_of_week: 4, hour: 21, avg_views: 10500, avg_likes: 780, sample_count: 138, label: '周四 21:00 周末前夜' },
      { day_of_week: 5, hour: 18, avg_views: 13000, avg_likes: 980, sample_count: 160, label: '周五 18:00 下班通勤时段' },
      { day_of_week: 5, hour: 22, avg_views: 14500, avg_likes: 1100, sample_count: 155, label: '周五 22:00 周五深夜档' },
      { day_of_week: 6, hour: 10, avg_views: 12000, avg_likes: 890, sample_count: 148, label: '周六 10:00 周末上午' },
      { day_of_week: 6, hour: 15, avg_views: 11000, avg_likes: 820, sample_count: 140, label: '周六 15:00 午后休闲' },
      { day_of_week: 0, hour: 21, avg_views: 13800, avg_likes: 1050, sample_count: 158, label: '周日 21:00 周末晚间' },
    ];
  }
}

export const trafficService = new TrafficService();

