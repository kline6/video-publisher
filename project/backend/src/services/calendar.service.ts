import { Pool } from 'pg';
import { config } from '../config';
import { ContentCalendar, CreateCalendarDTO } from '../types';

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.username,
  password: config.db.password,
  database: config.db.database,
});

export class CalendarService {
  /**
   * 获取日历事件（按月/周）
   */
  async getEvents(userId: number, startDate: string, endDate: string): Promise<ContentCalendar[]> {
    const result = await pool.query(
      `SELECT * FROM content_calendar
       WHERE user_id = $1 AND date >= $2 AND date <= $3
       ORDER BY date ASC, time ASC`,
      [userId, startDate, endDate]
    );
    return result.rows;
  }

  /**
   * 创建日历事件
   */
  async createEvent(userId: number, data: CreateCalendarDTO): Promise<ContentCalendar> {
    const result = await pool.query(
      `INSERT INTO content_calendar (user_id, title, description, date, time, color, publish_task_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        userId,
        data.title,
        data.description || null,
        data.date,
        data.time || null,
        data.color || '#3B82F6',
        data.publish_task_id || null,
      ]
    );
    return result.rows[0];
  }

  /**
   * 更新日历事件
   */
  async updateEvent(eventId: number, userId: number, data: Partial<CreateCalendarDTO>): Promise<ContentCalendar | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.title !== undefined) { fields.push(`title = $${idx++}`); values.push(data.title); }
    if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
    if (data.date !== undefined) { fields.push(`date = $${idx++}`); values.push(data.date); }
    if (data.time !== undefined) { fields.push(`time = $${idx++}`); values.push(data.time); }
    if (data.color !== undefined) { fields.push(`color = $${idx++}`); values.push(data.color); }

    if (fields.length === 0) return null;

    fields.push('updated_at = NOW()');
    values.push(eventId, userId);

    const result = await pool.query(
      `UPDATE content_calendar SET ${fields.join(', ')}
       WHERE id = $${idx} AND user_id = $${idx + 1}
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  /**
   * 删除日历事件
   */
  async deleteEvent(eventId: number, userId: number): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM content_calendar WHERE id = $1 AND user_id = $2',
      [eventId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export const calendarService = new CalendarService();
