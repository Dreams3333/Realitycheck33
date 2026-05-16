import dotenv from 'dotenv';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

dotenv.config();

// Use WebSocket for Node.js runtime — avoids Neon TCP cold-start timeouts
neonConfig.webSocketConstructor = ws;

const rawUrl = process.env.DATABASE_URL ?? '';
// pg does not support channel_binding — strip it
const connectionString = rawUrl
  .replace(/[?&]channel_binding=[^&]*/g, '')
  .replace(/\?$/, '') || undefined;

export const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 8000,
  max: 1,
});

pool.on('error', (err: Error) => console.error('DB pool error', err));

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const { rows } = await pool.query(text, params);
  return rows as T[];
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
