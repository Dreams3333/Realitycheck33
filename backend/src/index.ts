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

// Stripe webhook needs raw body
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Fail fast if DATABASE_URL is missing (avoids silent hangs on Vercel)
app.use('/api', (_req, res, next) => {
  if (!process.env.DATABASE_URL) {
    res.status(503).json({ message: 'Database not configured. Set DATABASE_URL on Vercel.' });
    return;
  }
  next();
});

// Run migrations once per cold start before first request
let migrated = false;
let migrationPromise: Promise<void> | null = null;
app.use(async (_req, _res, next) => {
  if (!migrated && process.env.DATABASE_URL) {
    if (!migrationPromise) {
      migrationPromise = runMigrations()
        .then(() => { migrated = true; })
        .catch(err => { console.error('Migration error:', err); });
    }
    await migrationPromise;
  }
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/claims', claimsRouter);
app.use('/api/stripe', stripeRouter);
app.use('/api/admin', adminRouter);

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

// Local dev: listen normally
if (!process.env.VERCEL) {
  const PORT_NUM = parseInt(process.env.PORT || '3000', 10);
  app.listen(PORT_NUM, () => {
    console.log(`Reality Check API running on port ${PORT_NUM}`);
  });
}

export default app;
