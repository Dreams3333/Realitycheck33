import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { analyzeClaim, GeneratedPerspective } from '../services/claude.js';
import { Claim, Perspective, User } from '../types/index.js';

const router = Router();

// GET /api/claims/trending
router.get('/trending', async (_req: Request, res: Response): Promise<void> => {
  const claims = await query<any>(
    `SELECT
       c.id, c.text, c.category, c.heat_score, c.view_count,
       c.status, c.created_at,
       u.display_name as submitted_by_name,
       COUNT(DISTINCT cm.id) as comment_count,
       COUNT(DISTINCT p.id) as perspective_count
     FROM claims c
     LEFT JOIN users u ON u.id = c.submitted_by
     LEFT JOIN comments cm ON cm.claim_id = c.id
     LEFT JOIN perspectives p ON p.claim_id = c.id
     WHERE c.status = 'processed'
     GROUP BY c.id, u.display_name
     ORDER BY c.heat_score DESC, c.view_count DESC
     LIMIT 50`
  );

  res.json(
    claims.map((c) => ({
      id: c.id,
      text: c.text,
      category: c.category,
      heatScore: c.heat_score,
      viewCount: c.view_count,
      status: c.status,
      createdAt: c.created_at,
      submittedByName: c.submitted_by_name ?? 'Anonymous',
      commentCount: parseInt(c.comment_count, 10),
      perspectives: [],
    }))
  );
});

// GET /api/claims/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const claim = await queryOne<Claim>('SELECT * FROM claims WHERE id = $1', [req.params.id]);
  if (!claim) {
    res.status(404).json({ message: 'Claim not found' });
    return;
  }

  // Increment view count
  query('UPDATE claims SET view_count = view_count + 1 WHERE id = $1', [claim.id]);

  const perspectives = await query<Perspective>(
    'SELECT * FROM perspectives WHERE claim_id = $1 ORDER BY created_at',
    [claim.id]
  );

  const submitter = await queryOne<User>('SELECT display_name FROM users WHERE id = $1', [
    claim.submitted_by,
  ]);
  const commentCount = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM comments WHERE claim_id = $1',
    [claim.id]
  );

  res.json({
    id: claim.id,
    text: claim.text,
    category: claim.category,
    heatScore: claim.heat_score,
    viewCount: claim.view_count,
    status: claim.status,
    createdAt: claim.created_at,
    submittedByName: submitter?.display_name ?? 'Anonymous',
    commentCount: parseInt(commentCount?.count ?? '0', 10),
    perspectives: perspectives.map((p) => ({
      type: p.type,
      label: p.label,
      summary: p.summary,
      analysis: p.analysis,
      sources: p.sources,
      isPremiumOnly: p.is_premium_only,
    })),
  });
});

const MIN_CLAIM_LENGTH = 10;
const MAX_CLAIM_LENGTH = 500;

// POST /api/claims
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { text, category } = req.body;
  const trimmed = typeof text === 'string' ? text.trim() : '';

  if (!trimmed || !category) {
    res.status(400).json({ message: 'Text and category are required' });
    return;
  }
  if (trimmed.length < MIN_CLAIM_LENGTH || trimmed.length > MAX_CLAIM_LENGTH) {
    res.status(400).json({
      message: `Claim text must be between ${MIN_CLAIM_LENGTH} and ${MAX_CLAIM_LENGTH} characters.`,
    });
    return;
  }

  const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', [req.user!.id]);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  // Check daily limit
  if (user.tier === 'free' && user.checks_used_today >= user.daily_limit) {
    res.status(429).json({ message: 'Daily limit reached. Upgrade to Premium for unlimited checks.' });
    return;
  }

  // Increment check count
  await query(
    'UPDATE users SET checks_used_today = checks_used_today + 1, updated_at = NOW() WHERE id = $1',
    [user.id]
  );

  // Create claim
  const [claim] = await query<Claim>(
    'INSERT INTO claims (text, category, submitted_by, status) VALUES ($1, $2, $3, $4) RETURNING *',
    [trimmed, category, user.id, 'processing']
  );

  try {
    const isPremium = user.tier === 'premium';

    // Dedupe: if an identical claim (case/whitespace-insensitive) was already
    // processed, reuse its perspectives/heat score instead of calling Claude again.
    // Skip reuse when a premium user needs the contrarian perspective and the
    // cached claim doesn't have one (e.g. it was originally submitted by a free user).
    const existing = await queryOne<Claim>(
      `SELECT * FROM claims
       WHERE id != $1 AND status = 'processed' AND LOWER(TRIM(text)) = LOWER($2)
         AND created_at > NOW() - INTERVAL '7 days'
       ORDER BY created_at DESC LIMIT 1`,
      [claim.id, trimmed]
    );

    let perspectives: GeneratedPerspective[];
    let heatScore: number;

    let reused = false;
    if (existing) {
      const existingPerspectives = await query<any>(
        'SELECT * FROM perspectives WHERE claim_id = $1',
        [existing.id]
      );
      const hasContrarian = existingPerspectives.some((p) => p.type === 'contrarian');
      if (!isPremium || hasContrarian) {
        perspectives = existingPerspectives
          .filter((p) => isPremium || !p.is_premium_only)
          .map((p) => ({
            type: p.type,
            label: p.label,
            summary: p.summary,
            analysis: p.analysis,
            sources: p.sources,
            isPremiumOnly: p.is_premium_only,
          }));
        heatScore = existing.heat_score;
        reused = true;
      }
    }

    if (!reused) {
      const analysis = await analyzeClaim(trimmed, category, isPremium);
      perspectives = analysis.perspectives;
      heatScore = analysis.heatScore;
    }

    await query('UPDATE claims SET heat_score = $1, status = $2, updated_at = NOW() WHERE id = $3', [
      heatScore!, 'processed', claim.id,
    ]);

    for (const p of perspectives!) {
      await query(
        `INSERT INTO perspectives (claim_id, type, label, summary, analysis, sources, is_premium_only)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [claim.id, p.type, p.label, p.summary, p.analysis, JSON.stringify(p.sources), p.isPremiumOnly]
      );
    }

    res.status(201).json({ id: claim.id, status: 'processed' });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Failed to generate perspectives:', errMsg, err);
    await query("UPDATE claims SET status = 'failed' WHERE id = $1", [claim.id]);
    res.status(202).json({ id: claim.id, status: 'failed', message: 'Perspective generation failed' });
  }
});

// GET /api/claims/:id/comments
router.get('/:id/comments', async (req: Request, res: Response): Promise<void> => {
  const comments = await query<any>(
    `SELECT
       c.id, c.claim_id, c.text, c.likes, c.created_at,
       u.id as user_id, u.display_name as user_display_name, u.avatar_url as user_avatar_url
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.claim_id = $1
     ORDER BY c.likes DESC, c.created_at DESC
     LIMIT 100`,
    [req.params.id]
  );

  res.json(
    comments.map((c) => ({
      id: c.id,
      claimId: c.claim_id,
      userId: c.user_id,
      userDisplayName: c.user_display_name,
      userAvatarUrl: c.user_avatar_url,
      text: c.text,
      likes: c.likes,
      isLiked: false,
      createdAt: c.created_at,
    }))
  );
});

// POST /api/claims/:id/comments
router.post('/:id/comments', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { text } = req.body;
  if (!text?.trim()) {
    res.status(400).json({ message: 'Comment text is required' });
    return;
  }

  const [comment] = await query<any>(
    'INSERT INTO comments (claim_id, user_id, text) VALUES ($1, $2, $3) RETURNING *',
    [req.params.id, req.user!.id, text.trim()]
  );

  const user = await queryOne<User>('SELECT display_name, avatar_url FROM users WHERE id = $1', [
    req.user!.id,
  ]);

  res.status(201).json({
    id: comment.id,
    claimId: comment.claim_id,
    userId: comment.user_id,
    userDisplayName: user?.display_name ?? 'Anonymous',
    userAvatarUrl: user?.avatar_url,
    text: comment.text,
    likes: 0,
    isLiked: false,
    createdAt: comment.created_at,
  });
});

// POST /api/claims/:id/comments/:commentId/like
router.post('/:id/comments/:commentId/like', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { commentId } = req.params;
  const userId = req.user!.id;

  const existing = await queryOne(
    'SELECT 1 FROM comment_likes WHERE comment_id = $1 AND user_id = $2',
    [commentId, userId]
  );

  if (existing) {
    await query('DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);
    await query('UPDATE comments SET likes = GREATEST(0, likes - 1) WHERE id = $1', [commentId]);
    res.json({ liked: false });
  } else {
    await query('INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)', [commentId, userId]);
    await query('UPDATE comments SET likes = likes + 1 WHERE id = $1', [commentId]);
    res.json({ liked: true });
  }
});

export default router;
