import bcrypt from 'bcryptjs';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { Pool } from 'pg';
import { config } from '../config';
import { CreateUserDTO, LoginDTO, AuthResponse, User } from '../types';
import { logger } from '../utils/logger';

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.username,
  password: config.db.password,
  database: config.db.database,
});

export class AuthService {
  async register(data: CreateUserDTO): Promise<AuthResponse> {
    const { username, email, password } = data;

    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existing.rows.length > 0) {
      throw new Error('User with this email or username already exists');
    }

    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, avatar_url, role, created_at, updated_at`,
      [username, email, password_hash]
    );

    const user = result.rows[0];
    const token = this.generateToken(user);

    return { token, user };
  }

  async login(data: LoginDTO): Promise<AuthResponse> {
    const { email, password } = data;

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user: User = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      throw new Error('Invalid email or password');
    }

    const token = this.generateToken(user);
    const { password_hash, ...userWithoutPassword } = user;

    return { token, user: userWithoutPassword as any };
  }

  async getProfile(userId: number): Promise<Omit<User, 'password_hash'>> {
    const result = await pool.query(
      'SELECT id, username, email, avatar_url, role, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0];
  }

  async updateProfile(userId: number, data: Partial<Pick<User, 'username' | 'avatar_url'>>): Promise<Omit<User, 'password_hash'>> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.username) {
      fields.push(`username = $${paramIndex++}`);
      values.push(data.username);
    }
    if (data.avatar_url !== undefined) {
      fields.push(`avatar_url = $${paramIndex++}`);
      values.push(data.avatar_url);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push('updated_at = NOW()');
    values.push(userId);

    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, username, email, avatar_url, role, created_at, updated_at`,
      values
    );

    return result.rows[0];
  }

  private generateToken(user: any): string {
    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role || 'user',
    };
    const secret: Secret = config.jwt.secret;
    const options: SignOptions = {
      expiresIn: config.jwt.expiresIn as any,
    };
    return jwt.sign(payload, secret, options);
  }
}

export const authService = new AuthService();
