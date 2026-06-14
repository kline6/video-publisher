import { Pool } from 'pg';
import { config } from './index';
import { logger } from '../utils/logger';

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.username,
  password: config.db.password,
  database: config.db.database,
  max: 20,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error:', err);
});

export async function testConnection(): Promise<void> {
  try {
    const client = await pool.connect();
    logger.info('PostgreSQL connection established successfully');
    client.release();
  } catch (error) {
    logger.error('Unable to connect to PostgreSQL:', error);
    throw error;
  }
}
