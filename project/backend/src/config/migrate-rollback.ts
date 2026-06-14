import { config } from './index';
import { logger } from '../utils/logger';
import { Client } from 'pg';

const ROLLBACK_MIGRATIONS = [
  { name: '008_create_content_calendar', sql: 'DROP TABLE IF EXISTS content_calendar CASCADE;' },
  { name: '007_create_ai_generations', sql: 'DROP TABLE IF EXISTS ai_generations CASCADE;' },
  { name: '006_create_hot_topics', sql: 'DROP TABLE IF EXISTS hot_topics CASCADE;' },
  { name: '005_create_traffic_suggestions', sql: 'DROP TABLE IF EXISTS traffic_suggestions CASCADE;' },
  { name: '004_create_video_stats', sql: 'DROP TABLE IF EXISTS video_stats CASCADE;' },
  { name: '003_create_publish_tasks', sql: 'DROP TABLE IF EXISTS publish_tasks CASCADE;' },
  { name: '002_create_platform_accounts', sql: 'DROP TABLE IF EXISTS platform_accounts CASCADE;' },
  { name: '001_create_users', sql: 'DROP TABLE IF EXISTS users CASCADE;' },
];

export async function rollbackMigrations(): Promise<void> {
  const client = new Client({
    host: config.db.host,
    port: config.db.port,
    user: config.db.username,
    password: config.db.password,
    database: config.db.database,
  });

  try {
    await client.connect();
    logger.info('Connected to PostgreSQL for rollback');

    for (const migration of ROLLBACK_MIGRATIONS) {
      logger.info(`Rolling back: ${migration.name}`);
      try {
        await client.query(migration.sql);
        await client.query('DELETE FROM migrations WHERE name = $1', [migration.name]);
        logger.info(`Rolled back: ${migration.name}`);
      } catch (error) {
        logger.error(`Rollback failed for ${migration.name}:`, error);
      }
    }

    logger.info('Rollback completed');
  } catch (error) {
    logger.error('Rollback process failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  rollbackMigrations();
}
