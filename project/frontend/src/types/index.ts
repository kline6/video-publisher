export interface User {
  id: number;
  username: string;
  email: string;
  avatar_url?: string;
  role: string;
}

export type Platform = 'douyin' | 'bilibili' | 'youtube' | 'kuaishou' | 'weixin' | 'tiktok';

export interface PlatformAccount {
  id: number;
  platform: Platform;
  platform_user_id?: string;
  nickname?: string;
  avatar_url?: string;
  status: 'active' | 'expired' | 'revoked';
}

export type TaskStatus = 'pending' | 'processing' | 'scheduled' | 'publishing' | 'success' | 'failed' | 'partial';

export interface PublishTask {
  id: number;
  title: string;
  description?: string;
  tags: string[];
  video_url?: string;
  cover_url?: string;
  platforms: Platform[];
  status: TaskStatus;
  scheduled_at?: string;
  published_at?: string;
  error_message?: string;
  publish_results: Array<{
    platform: Platform;
    platform_video_id?: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
  created_at: string;
}

export interface HotTopic {
  id: number;
  platform: Platform;
  title: string;
  url?: string;
  heat_value: number;
  category?: string;
}

export interface DashboardStats {
  total_videos: number;
  total_views: number;
  total_likes: number;
  total_followers: number;
  platform_breakdown: Record<Platform, { videos: number; views: number; likes: number }>;
  trend_data: Array<{ date: string; views: number; likes: number }>;
}

export interface ContentCalendar {
  id: number;
  title: string;
  description?: string;
  date: string;
  time?: string;
  status: 'planned' | 'scheduled' | 'published' | 'cancelled';
  color: string;
  publish_task_id?: number;
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  douyin: '抖音',
  bilibili: 'B站',
  youtube: 'YouTube',
  kuaishou: '快手',
  weixin: '视频号',
  tiktok: 'TikTok',
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  douyin: '#000000',
  bilibili: '#00A1D6',
  youtube: '#FF0000',
  kuaishou: '#FF4906',
  weixin: '#07C160',
  tiktok: '#010101',
};
