import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, queryOne } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../types/index.js';

const router = Router();

function signToken(user: Pick<User, 'id' | 'email' | 'tier'>): string {
  return jwt.sign(
    { id: user.id, email: user.email, tier: user.tier },
    process.env.JWT_SECRET!,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
  );
}

function sanitizeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    tier: user.tier,
    checksUsedToday: user.checks_used_today,
    dailyLimit: user.daily_limit,
    createdAt: user.created_at,
  };
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, password, displayName, startTrial } = req.body;

  if (!email || !password || !displayName) {
    res.status(400).json({ message: 'Email, password, and display name are required' });
    return;
  }

  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing) {
    res.status(409).json({ message: 'An account with this email already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const trialEndsAt = startTrial ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null;
  const tier = startTrial ? 'premium' : 'free';

  const [user] = await query<User>(
    `INSERT INTO users (email, display_name, password_hash, tier, trial_ends_at, daily_limit)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [email.toLowerCase(), displayName, passwordHash, tier, trialEndsAt, tier === 'free' ? 5 : 999]
  );

  res.status(201).json({ user: sanitizeUser(user), token: signToken(user) });
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  const user = await queryOne<User>('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  if (!user || !user.password_hash) {
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  // Expire trial if needed
  if (user.tier === 'premium' && user.trial_ends_at && new Date() > user.trial_ends_at) {
    await query('UPDATE users SET tier = $1, daily_limit = $2 WHERE id = $3', ['free', 5, user.id]);
    user.tier = 'free';
    user.daily_limit = 5;
  }

  res.json({ user: sanitizeUser(user), token: signToken(user) });
});

// POST /api/auth/google
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  const { idToken } = req.body;
  // In production: verify idToken with Google's API
  // For now, decode the payload (demo only)
  res.status(501).json({ message: 'Google sign-in requires server-side token verification setup' });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', [req.user!.id]);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  res.json(sanitizeUser(user));
});

export default router;
