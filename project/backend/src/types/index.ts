// ===== User =====
export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  avatar_url?: string;
  role: 'user' | 'admin';
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserDTO {
  username: string;
  email: string;
  password: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: Omit<User, 'password_hash'>;
}

// ===== Platform =====
export type Platform = 'douyin' | 'bilibili' | 'youtube' | 'kuaishou' | 'weixin' | 'tiktok';

export interface PlatformAccount {
  id: number;
  user_id: number;
  platform: Platform;
  platform_user_id?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: Date;
  nickname?: string;
  avatar_url?: string;
  status: 'active' | 'expired' | 'revoked';
  extra_data: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// ===== Publish Task =====
export type TaskStatus = 'pending' | 'processing' | 'scheduled' | 'publishing' | 'success' | 'failed' | 'partial';

export interface PublishTask {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  tags: string[];
  video_url?: string;
  cover_url?: string;
  platforms: Platform[];
  status: TaskStatus;
  scheduled_at?: Date;
  published_at?: Date;
  error_message?: string;
  publish_results: PublishResult[];
  created_at: Date;
  updated_at: Date;
}

export interface PublishResult {
  platform: Platform;
  platform_video_id?: string;
  status: 'success' | 'failed';
  error?: string;
  published_at?: string;
}

export interface CreatePublishTaskDTO {
  title: string;
  description?: string;
  tags?: string[];
  video_url?: string;
  cover_url?: string;
  platforms: Platform[];
  scheduled_at?: string;
}

// ===== Video Stats =====
export interface VideoStats {
  id: number;
  platform: Platform;
  platform_video_id: string;
  publish_task_id?: number;
  platform_account_id?: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  collected_at: Date;
}

// ===== Traffic =====
export type SuggestionType = 'title_optimize' | 'best_time' | 'hot_topic' | 'tag_suggest';

export interface TrafficSuggestion {
  id: number;
  user_id: number;
  type: SuggestionType;
  input?: string;
  output?: string;
  metadata: Record<string, any>;
  applied: boolean;
  created_at: Date;
}

export interface HotTopic {
  id: number;
  platform: Platform;
  title: string;
  url?: string;
  heat_value: number;
  category?: string;
  fetched_at: Date;
}

// ===== AI =====
export type GenerationType = 'script' | 'title' | 'tags' | 'description' | 'cover_prompt';

export interface AiGeneration {
  id: number;
  user_id: number;
  type: GenerationType;
  prompt: string;
  result?: string;
  model?: string;
  tokens_used: number;
  created_at: Date;
}

export interface GenerateScriptDTO {
  topic: string;
  style: 'educational' | 'story' | 'fast-paced';
  duration?: number;
  platform?: Platform;
}

export interface GenerateTitleDTO {
  topic: string;
  style?: string;
  count?: number;
  platform?: Platform;
}

export interface GenerateTagsDTO {
  title: string;
  description?: string;
  platform?: Platform;
}

// ===== Calendar =====
export interface ContentCalendar {
  id: number;
  user_id: number;
  publish_task_id?: number;
  title: string;
  description?: string;
  date: string;
  time?: string;
  status: 'planned' | 'scheduled' | 'published' | 'cancelled';
  color: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCalendarDTO {
  title: string;
  description?: string;
  date: string;
  time?: string;
  color?: string;
  publish_task_id?: number;
}

// ===== Dashboard =====
export interface DashboardStats {
  total_videos: number;
  total_views: number;
  total_likes: number;
  total_followers: number;
  platform_breakdown: Record<Platform, {
    videos: number;
    views: number;
    likes: number;
  }>;
  trend_data: Array<{
    date: string;
    views: number;
    likes: number;
  }>;
}
