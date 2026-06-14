const {
  REDIS_HOST = '127.0.0.1',
  REDIS_PORT = '6379',
  REDIS_PASSWORD = 'password',
  MONGODB_HOST = '127.0.0.1',
  MONGODB_PORT = '27017',
  ASSETS_CONFIG = '{"provider":"local","uploadDir":"./uploads"}',
  AI_URL = 'http://127.0.0.1:3010',
  JWT_SECRET = 'dev-jwt-secret-changeme',
  INTERNAL_TOKEN = 'dev-internal-token-changeme',
  NODE_ENV = 'development',
  APP_DOMAIN = 'localhost',
  SUPER_CODE = '',
} = process.env

module.exports = {
  appDomain: APP_DOMAIN,
  port: 3002,
  environment: NODE_ENV,
  enableBadRequestDetails: true,
  superCode: SUPER_CODE,

  auth: {
    secret: JWT_SECRET,
    internalToken: INTERNAL_TOKEN,
  },

  logger: {
    console: { enable: true, level: 'debug', pretty: false },
  },

  mongodb: {
    uri: `mongodb://${MONGODB_HOST}:${MONGODB_PORT}/videoflow?directConnection=true`,
    dbName: 'videoflow',
  },

  redis: {
    host: REDIS_HOST,
    port: Number(REDIS_PORT),
    username: 'default',
    password: REDIS_PASSWORD,
  },
  redlock: {
    redis: {
      host: REDIS_HOST,
      port: Number(REDIS_PORT),
      username: 'default',
      password: REDIS_PASSWORD,
    },
  },

  channel: {
    channelDb: {
      uri: `mongodb://${MONGODB_HOST}:${MONGODB_PORT}/videoflow_channel?directConnection=true`,
      dbName: 'videoflow_channel',
    },
    moreApi: { platApiUri: '' },
    shortLink: { baseUrl: '' },
    bilibili: { id: '', secret: '', authBackHost: '' },
    google: { id: '', secret: '', authBackHost: '' },
    googleBusiness: { clientId: '', clientSecret: '', redirectUri: '' },
    kwai: { id: '', secret: '', authBackHost: '' },
    pinterest: { id: '', secret: '', authBackHost: '', baseUrl: '', test_authorization: '' },
    tiktok: { clientId: '', clientSecret: '', redirectUri: '', scopes: [] },
    twitter: { clientId: '', clientSecret: '', redirectUri: '', pricing: { read: { post: 0.5, user: 1, media: 0.5, list: 0.5 }, write: { contentCreate: 1.5, contentCreateWithUrl: 20, interactionCreate: 1.5, interactionDelete: 1, contentManage: 0.5, bookmark: 0.5, metadata: 0.5 } } },
    oauth: {
      facebook: { clientId: '', clientSecret: '', configId: '', redirectUri: '', scopes: [] },
      threads: { clientId: '', clientSecret: '', redirectUri: '', scopes: [] },
      instagram: { clientId: '', clientSecret: '', redirectUri: '', scopes: [] },
      linkedin: { clientId: '', clientSecret: '', redirectUri: '', scopes: [] },
    },
    wxPlat: { id: '', secret: '', token: '', encodingAESKey: '', authBackHost: '' },
    myWxPlat: { id: '', secret: '', hostUrl: '' },
    youtube: { id: '', secret: '', authBackHost: '' },
    douyin: { id: '', secret: '', authBackHost: '' },
  },

  assets: JSON.parse(ASSETS_CONFIG),
  mail: {
    transport: { host: '', port: 587, secure: false, auth: { user: '', pass: '' } },
    defaults: { from: '' },
  },
  aliSms: { accessKeyId: '', accessKeySecret: '', signName: '', templateCode: '' },
  aiClient: { baseUrl: AI_URL, token: INTERNAL_TOKEN },
}
