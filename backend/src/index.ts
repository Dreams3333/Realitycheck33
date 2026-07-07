import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// A single bad request must never crash the whole server (was causing 502 crash-loops).
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

import authRouter from './routes/auth.js';
import claimsRouter from './routes/claims.js';
import stripeRouter from './routes/stripe.js';
import adminRouter from './routes/admin.js';
dotenv.config();

const app = express();

app.set('trust proxy', 1);

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

// Health check — no DB needed, answers immediately
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Gate all /api routes on DATABASE_URL presence
app.use('/api', (_req, res, next) => {
  if (!process.env.DATABASE_URL) {
    res.status(503).json({ message: 'DATABASE_URL is not configured.' });
    return;
  }
  next();
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

// Local dev only
if (!process.env.VERCEL) {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  app.listen(PORT, () => console.log(`Reality Check API running on port ${PORT}`));
}

export default app;
