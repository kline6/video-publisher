import { BasePlatformPublisher, PlatformPublishResult, VideoPublishData } from './base.pub';
import { logger } from '../../utils/logger';

interface KuaishouAccountData {
  cookie: string;
  did: string;
}

export class KuaishouPublisher extends BasePlatformPublisher {
  platform = 'kuaishou';

  async validateAccount(data: KuaishouAccountData): Promise<{ valid: boolean; nickname?: string; uid?: string; error?: string }> {
    try {
      const resp = await fetch('https://www.kuaishou.com/graphql', {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
          'Cookie': data.cookie,
          'Content-Type': 'application/json',
          'Referer': 'https://www.kuaishou.com/',
          'Origin': 'https://www.kuaishou.com',
        },
        body: JSON.stringify({
          operationName: 'visionProfilePhotoList',
          variables: { page: 'profile', pcursor: '', count: 1 },
          query: 'query visionProfilePhotoList($page: String, $pcursor: String, $count: Int) { visionProfilePhotoList(page: $page, pcursor: $pcursor, count: $count) { result hostCount } }',
        }),
        signal: AbortSignal.timeout(10000),
      });
      const json = await resp.json() as any;
      if (json.data?.visionProfilePhotoList?.result === 1) {
        return { valid: true, nickname: '快手用户', uid: data.did };
      }
      return { valid: false, error: 'Cookie 无效或已过期' };
    } catch (e: any) {
      return { valid: false, error: '连接失败: ' + e.message };
    }
  }

  async publish(data: KuaishouAccountData, video: VideoPublishData): Promise<PlatformPublishResult> {
    try {
      logger.info('[Kuaishou] Publish requested for: ' + video.title);
      return { success: false, error: '快手发布需要通过浏览器自动化操作，请在快手网页版手动发布后输入视频链接' };
    } catch (e: any) {
      return { success: false, error: '发布异常: ' + e.message };
    }
  }

  async fetchStats(data: KuaishouAccountData, platformVideoId: string): Promise<{ views: number; likes: number; comments: number; shares: number }> {
    return { views: 0, likes: 0, comments: 0, shares: 0 };
  }
}

export const kuaishouPublisher = new KuaishouPublisher();
