import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.username,
  password: config.db.password,
  database: config.db.database,
});

export interface UserSettings {
  id: number;
  user_id: number;
  ai_api_url: string;
  ai_api_key: string;
  ai_model: string;
  ai_available_models: string[];
  created_at: Date;
  updated_at: Date;
}

export class SettingsService {
  async getSettings(userId: number): Promise<UserSettings | null> {
    const result = await pool.query(
      'SELECT * FROM user_settings WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  async getOrCreateSettings(userId: number): Promise<UserSettings | null> {
    let settings = await this.getSettings(userId);
    if (!settings) {
      const result = await pool.query(
        `INSERT INTO user_settings (user_id) VALUES ($1) RETURNING *`,
        [userId]
      );
      settings = result.rows[0];
    }
    return settings;
  }

  async updateSettings(userId: number, data: {
    ai_api_url?: string;
    ai_api_key?: string;
    ai_model?: string;
    ai_available_models?: string[];
  }): Promise<UserSettings> {
    await this.getOrCreateSettings(userId);

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (data.ai_api_url !== undefined) { setClauses.push(`ai_api_url = $${paramIdx++}`); values.push(data.ai_api_url); }
    if (data.ai_api_key !== undefined) { setClauses.push(`ai_api_key = $${paramIdx++}`); values.push(data.ai_api_key); }
    if (data.ai_model !== undefined) { setClauses.push(`ai_model = $${paramIdx++}`); values.push(data.ai_model); }
    if (data.ai_available_models !== undefined) { setClauses.push(`ai_available_models = $${paramIdx++}`); values.push(JSON.stringify(data.ai_available_models)); }

    if (setClauses.length === 0) {
      return this.getOrCreateSettings(userId);
    }

    setClauses.push('updated_at = NOW()');
    values.push(userId);

    const updateResult = await pool.query(
      `UPDATE user_settings SET ${setClauses.join(', ')} WHERE user_id = $${paramIdx} RETURNING *`,
      values
    );

    return updateResult.rows[0];
  }

  async testAiConnection(apiUrl: string, apiKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const url = apiUrl.replace(/\/+$/, '') + '/models';
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        return { success: true, message: '连接成功！API Key 有效。' };
      } else {
        const text = await response.text();
        return { success: false, message: `连接失败: HTTP ${response.status} - ${text.slice(0, 200)}` };
      }
    } catch (error: any) {
      return { success: false, message: `连接失败: ${error.message}` };
    }
  }

  async fetchAvailableModels(apiUrl: string, apiKey: string): Promise<{ success: boolean; models: string[]; message?: string }> {
    try {
      const url = apiUrl.replace(/\/+$/, '') + '/models';
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, models: [], message: `获取失败: HTTP ${response.status}` };
      }

      const data = await response.json() as any;
      const models: string[] = (data.data || [])
        .map((m: any) => m.id)
        .filter((id: string) => typeof id === 'string')
        .sort();

      return { success: true, models };
    } catch (error: any) {
      return { success: false, models: [], message: `获取失败: ${error.message}` };
    }
  }
}

export const settingsService = new SettingsService();
