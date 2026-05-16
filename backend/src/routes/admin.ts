import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAdmin } from '../middleware/auth.js';
import { sendWeeklyDigest } from '../services/email.js';

const router = Router();

// GET /api/admin/stats
router.get('/stats', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const [totalUsers] = await query<{ count: string }>('SELECT COUNT(*) as count FROM users');
  const [premiumUsers] = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM users WHERE tier = 'premium'"
  );
  const [totalClaims] = await query<{ count: string }>('SELECT COUNT(*) as count FROM claims');
  const [weeklySignups] = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL '7 days'"
  );
  const [dailyActiveUsers] = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM users WHERE checks_used_today > 0"
  );

  res.json({
    totalUsers: parseInt(totalUsers.count, 10),
    premiumUsers: parseInt(premiumUsers.count, 10),
    totalClaims: parseInt(totalClaims.count, 10),
    weeklySignups: parseInt(weeklySignups.count, 10),
    dailyActiveUsers: parseInt(dailyActiveUsers.count, 10),
    estimatedMRR: parseInt(premiumUsers.count, 10) * 4.99,
  });
});

// GET /api/admin/users
router.get('/users', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  const users = await query(
    `SELECT id, email, display_name, tier, checks_used_today, created_at, trial_ends_at
     FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const [{ count }] = await query<{ count: string }>('SELECT COUNT(*) as count FROM users');

  res.json({ users, total: parseInt(count, 10), page, limit });
});

// GET /api/admin/claims
router.get('/claims', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  const claims = await query(
    `SELECT c.id, c.text, c.category, c.heat_score, c.status, c.view_count, c.created_at,
            u.display_name as submitted_by_name,
            COUNT(DISTINCT p.id) as perspective_count,
            COUNT(DISTINCT cm.id) as comment_count
     FROM claims c
     LEFT JOIN users u ON u.id = c.submitted_by
     LEFT JOIN perspectives p ON p.claim_id = c.id
     LEFT JOIN comments cm ON cm.claim_id = c.id
     GROUP BY c.id, u.display_name
     ORDER BY c.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const [{ count }] = await query<{ count: string }>('SELECT COUNT(*) as count FROM claims');

  res.json({ claims, total: parseInt(count, 10), page, limit });
});

// POST /api/admin/digest
router.post('/digest', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    await sendWeeklyDigest();
    res.json({ message: 'Weekly digest sent successfully' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/claims/:id
router.delete('/claims/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  await query('DELETE FROM claims WHERE id = $1', [req.params.id]);
  res.json({ message: 'Claim deleted' });
});

export default router;
