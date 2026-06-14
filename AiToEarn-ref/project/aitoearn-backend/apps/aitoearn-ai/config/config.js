const {
  REDIS_HOST = '127.0.0.1',
  REDIS_PORT = '6379',
  REDIS_PASSWORD = 'password',
  MONGODB_HOST = '127.0.0.1',
  MONGODB_PORT = '27017',
  ASSETS_CONFIG = '{"provider":"local","uploadDir":"./uploads"}',
  SERVER_URL = 'http://127.0.0.1:3002',
  JWT_SECRET = 'dev-jwt-secret-changeme',
  INTERNAL_TOKEN = 'dev-internal-token-changeme',
  NODE_ENV = 'development',
  OPENAI_API_KEY = '',
  OPENAI_BASE_URL = 'https://api.openai.com/v1',
  ANTHROPIC_API_KEY = '',
  ANTHROPIC_BASE_URL = 'https://api.anthropic.com',
} = process.env

module.exports = {
  port: 3010,
  environment: NODE_ENV,

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

  assets: JSON.parse(ASSETS_CONFIG),

  server: {
    url: SERVER_URL,
    token: INTERNAL_TOKEN,
  },

  openai: {
    apiKey: OPENAI_API_KEY,
    baseUrl: OPENAI_BASE_URL,
  },

  anthropic: {
    apiKey: ANTHROPIC_API_KEY,
    baseUrl: ANTHROPIC_BASE_URL,
  },
}
