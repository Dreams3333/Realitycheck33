import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRouter from './routes/auth.js';
import claimsRouter from './routes/claims.js';
import stripeRouter from './routes/stripe.js';
import adminRouter from './routes/admin.js';
import { runMigrations } from './db/migrate.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Stripe webhook must receive raw body
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/claims', claimsRouter);
app.use('/api/stripe', stripeRouter);
app.use('/api/admin', adminRouter);

// Daily reset cron (simple internal cron — use Railway cron job for production)
function scheduleMidnightReset() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight.getTime() - now.getTime();

  setTimeout(async () => {
    try {
      const { pool } = await import('./db/index.js');
      await pool.query('SELECT reset_daily_checks()');
      console.log('Daily check counts reset');
    } catch (err) {
      console.error('Failed to reset daily checks', err);
    }
    scheduleMidnightReset();
  }, msUntilMidnight);
}

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Reality Check API running on port ${PORT}`);
      scheduleMidnightReset();
    });
  })
  .catch((err) => {
    console.error('Failed to run migrations:', err);
    process.exit(1);
  });
