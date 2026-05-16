import dotenv from 'dotenv';
import { Pool } from 'pg';
dotenv.config();

const rawUrl = process.env.DATABASE_URL ?? '';
const isLocal = !rawUrl || rawUrl.includes('localhost');
// pg does not support channel_binding — strip it to avoid connection hangs
const connectionString = rawUrl.replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?$/, '');

export const pool = new Pool({
  connectionString: connectionString || undefined,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: process.env.VERCEL ? 1 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
});

pool.on('error', (err) => console.error('DB pool error', err));

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const { rows } = await pool.query(text, params);
  return rows as T[];
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
