import { config } from './index';
import { logger } from '../utils/logger';

// Database migration runner using raw pg
import { Client } from 'pg';

const MIGRATIONS = [
  {
    name: '001_create_users',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `,
  },
  {
    name: '002_create_platform_accounts',
    sql: `
      CREATE TABLE IF NOT EXISTS platform_accounts (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        platform VARCHAR(50) NOT NULL,
        platform_user_id VARCHAR(255),
        access_token TEXT,
        refresh_token TEXT,
        expires_at TIMESTAMP,
        nickname VARCHAR(255),
        avatar_url TEXT,
        status VARCHAR(20) DEFAULT 'active',
        extra_data JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, platform, platform_user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_platform_accounts_user ON platform_accounts(user_id);
      CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform ON platform_accounts(platform);
    `,
  },
  {
    name: '003_create_publish_tasks',
    sql: `
      CREATE TABLE IF NOT EXISTS publish_tasks (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        tags TEXT[] DEFAULT '{}',
        video_url VARCHAR(500),
        cover_url VARCHAR(500),
        platforms TEXT[] NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        scheduled_at TIMESTAMP,
        published_at TIMESTAMP,
        error_message TEXT,
        publish_results JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_publish_tasks_user ON publish_tasks(user_id);
      CREATE INDEX IF NOT EXISTS idx_publish_tasks_status ON publish_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_publish_tasks_scheduled ON publish_tasks(scheduled_at);
    `,
  },
  {
    name: '004_create_video_stats',
    sql: `
      CREATE TABLE IF NOT EXISTS video_stats (
        id SERIAL PRIMARY KEY,
        platform VARCHAR(50) NOT NULL,
        platform_video_id VARCHAR(255) NOT NULL,
        publish_task_id INT REFERENCES publish_tasks(id) ON DELETE SET NULL,
        platform_account_id INT REFERENCES platform_accounts(id) ON DELETE SET NULL,
        views INT DEFAULT 0,
        likes INT DEFAULT 0,
        comments INT DEFAULT 0,
        shares INT DEFAULT 0,
        collected_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_video_stats_task ON video_stats(publish_task_id);
      CREATE INDEX IF NOT EXISTS idx_video_stats_platform ON video_stats(platform, platform_video_id);
      CREATE INDEX IF NOT EXISTS idx_video_stats_collected ON video_stats(collected_at);
    `,
  },
  {
    name: '005_create_traffic_suggestions',
    sql: `
      CREATE TABLE IF NOT EXISTS traffic_suggestions (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        input TEXT,
        output TEXT,
        metadata JSONB DEFAULT '{}',
        applied BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_traffic_suggestions_user ON traffic_suggestions(user_id);
      CREATE INDEX IF NOT EXISTS idx_traffic_suggestions_type ON traffic_suggestions(type);
    `,
  },
  {
    name: '006_create_hot_topics',
    sql: `
      CREATE TABLE IF NOT EXISTS hot_topics (
        id SERIAL PRIMARY KEY,
        platform VARCHAR(50) NOT NULL,
        title VARCHAR(500) NOT NULL,
        url TEXT,
        heat_value BIGINT DEFAULT 0,
        category VARCHAR(100),
        fetched_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_hot_topics_platform ON hot_topics(platform);
      CREATE INDEX IF NOT EXISTS idx_hot_topics_fetched ON hot_topics(fetched_at);
      CREATE INDEX IF NOT EXISTS idx_hot_topics_heat ON hot_topics(heat_value DESC);
    `,
  },
  {
    name: '007_create_ai_generations',
    sql: `
      CREATE TABLE IF NOT EXISTS ai_generations (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        prompt TEXT NOT NULL,
        result TEXT,
        model VARCHAR(100),
        tokens_used INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ai_generations_user ON ai_generations(user_id);
    `,
  },
  {
    name: '008_create_content_calendar',
    sql: `
      CREATE TABLE IF NOT EXISTS content_calendar (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        publish_task_id INT REFERENCES publish_tasks(id) ON DELETE SET NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        time TIME,
        status VARCHAR(20) DEFAULT 'planned',
        color VARCHAR(20) DEFAULT '#3B82F6',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_content_calendar_user ON content_calendar(user_id);
      CREATE INDEX IF NOT EXISTS idx_content_calendar_date ON content_calendar(date);
    `,
  },
  {
    name: '009_create_user_settings',
    sql: `
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        ai_api_url VARCHAR(500) DEFAULT 'https://api.openai.com/v1',
        ai_api_key VARCHAR(500) DEFAULT '',
        ai_model VARCHAR(100) DEFAULT 'gpt-4o',
        ai_available_models JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);
    `,
  },
];

async function ensureMigrationsTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function getExecutedMigrations(client: Client): Promise<Set<string>> {
  const result = await client.query('SELECT name FROM migrations');
  return new Set(result.rows.map((r: any) => r.name));
}

export async function runMigrations(): Promise<void> {
  const client = new Client({
    host: config.db.host,
    port: config.db.port,
    user: config.db.username,
    password: config.db.password,
    database: config.db.database,
  });

  try {
    await client.connect();
    logger.info('Connected to PostgreSQL for migration');

    await ensureMigrationsTable(client);
    const executed = await getExecutedMigrations(client);

    for (const migration of MIGRATIONS) {
      if (executed.has(migration.name)) {
        logger.info(`Migration ${migration.name} already executed, skipping`);
        continue;
      }

      logger.info(`Running migration: ${migration.name}`);
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
        await client.query('COMMIT');
        logger.info(`Migration ${migration.name} completed`);
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Migration ${migration.name} failed:`, error);
        throw error;
      }
    }

    logger.info('All migrations completed');
  } catch (error) {
    logger.error('Migration process failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run when executed directly
if (require.main === module) {
  runMigrations();
}

