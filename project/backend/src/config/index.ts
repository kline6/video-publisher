import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'videouser',
    password: process.env.DB_PASSWORD || 'videopass',
    database: process.env.DB_DATABASE || 'videoflow',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
  },

  platforms: {
    douyin: {
      clientId: process.env.DOUYIN_CLIENT_ID || '',
      clientSecret: process.env.DOUYIN_CLIENT_SECRET || '',
      redirectUri: process.env.DOUYIN_REDIRECT_URI || '',
    },
    bilibili: {
      clientId: process.env.BILIBILI_CLIENT_ID || '',
      clientSecret: process.env.BILIBILI_CLIENT_SECRET || '',
      redirectUri: process.env.BILIBILI_REDIRECT_URI || '',
    },
    youtube: {
      clientId: process.env.YOUTUBE_CLIENT_ID || '',
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
      redirectUri: process.env.YOUTUBE_REDIRECT_URI || '',
    },
    kuaishou: {
      clientId: process.env.KUAISHOU_CLIENT_ID || '',
      clientSecret: process.env.KUAISHOU_CLIENT_SECRET || '',
      redirectUri: process.env.KUAISHOU_REDIRECT_URI || '',
    },
    weixin: {
      clientId: process.env.WEIXIN_CLIENT_ID || '',
      clientSecret: process.env.WEIXIN_CLIENT_SECRET || '',
      redirectUri: process.env.WEIXIN_REDIRECT_URI || '',
    },
    tiktok: {
      clientId: process.env.TIKTOK_CLIENT_ID || '',
      clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
      redirectUri: process.env.TIKTOK_REDIRECT_URI || '',
    },
  },

  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10),
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5174',
};
