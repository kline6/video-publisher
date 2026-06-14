import { logger } from '../../utils/logger';

export interface PlatformPublishResult {
  success: boolean;
  platform_video_id?: string;
  error?: string;
  permalink?: string;
}

export interface VideoPublishData {
  title: string;
  description?: string;
  videoPath: string;
  coverPath?: string;
  tags?: string[];
  tid?: number;
}

export abstract class BasePlatformPublisher {
  abstract platform: string;
  abstract publish(accountData: any, data: VideoPublishData): Promise<PlatformPublishResult>;
  abstract fetchStats(accountData: any, platformVideoId: string): Promise<{ views: number; likes: number; comments: number; shares: number }>;
  abstract validateAccount(accountData: any): Promise<{ valid: boolean; nickname?: string; uid?: string; error?: string }>;
}
