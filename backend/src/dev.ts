/**
 * Local development server — fully self-contained, no database required.
 * Uses in-memory storage with real bcrypt + JWT auth.
 * Run with: npm run dev:local
 */
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

app.use(express.json());
app.use(cors({ origin: '*' }));

// ─── In-Memory Store ────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  tier: 'free' | 'premium';
  checksUsedToday: number;
  dailyLimit: number;
  createdAt: string;
}

interface Comment {
  id: string;
  claimId: string;
  userId: string;
  userDisplayName: string;
  text: string;
  likes: number;
  likedBy: Set<string>;
  createdAt: string;
}

const users = new Map<string, User>();
const commentsByClaimId = new Map<string, Comment[]>();

function uid() { return crypto.randomUUID(); }

function signToken(user: User) {
  return jwt.sign(
    { id: user.id, email: user.email, tier: user.tier },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function sanitizeUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    tier: u.tier,
    checksUsedToday: u.checksUsedToday,
    dailyLimit: u.dailyLimit,
    createdAt: u.createdAt,
  };
}

function authMiddleware(req: any, res: any, next: any) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) { res.status(401).json({ message: 'No token' }); return; }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET) as any;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// ─── Health ──────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok', mode: 'local-dev' }));

// ─── Auth ────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const { email, password, displayName, startTrial } = req.body;
  if (!email || !password || !displayName) {
    res.status(400).json({ message: 'Email, password, and display name are required' }); return;
  }
  const exists = [...users.values()].find(u => u.email === email.toLowerCase());
  if (exists) { res.status(409).json({ message: 'Email already registered' }); return; }

  const passwordHash = await bcrypt.hash(password, 10);
  const tier: 'free' | 'premium' = startTrial ? 'premium' : 'free';
  const user: User = {
    id: uid(),
    email: email.toLowerCase(),
    displayName,
    passwordHash,
    tier,
    checksUsedToday: 0,
    dailyLimit: tier === 'premium' ? 999 : 5,
    createdAt: new Date().toISOString(),
  };
  users.set(user.id, user);
  res.status(201).json({ user: sanitizeUser(user), token: signToken(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ message: 'Email and password required' }); return; }
  const user = [...users.values()].find(u => u.email === email.toLowerCase());
  if (!user) { res.status(401).json({ message: 'Invalid email or password' }); return; }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) { res.status(401).json({ message: 'Invalid email or password' }); return; }
  res.json({ user: sanitizeUser(user), token: signToken(user) });
});

app.get('/api/auth/me', authMiddleware, (req: any, res) => {
  const user = users.get(req.user.id);
  if (!user) { res.status(404).json({ message: 'User not found' }); return; }
  res.json(sanitizeUser(user));
});

// ─── Claims ───────────────────────────────────────────────────────────────────

const MOCK_CLAIMS = [
  {
    id: 'c1',
    text: 'Social media algorithms are deliberately designed to maximize outrage and division.',
    category: 'Technology',
    heatScore: 78,
    commentCount: 142,
    viewCount: 8400,
    submittedByName: 'Alex M.',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    status: 'processed',
    perspectives: buildPerspectives('c1'),
  },
  {
    id: 'c2',
    text: "The US Federal Reserve's interest rate policies disproportionately benefit the wealthy.",
    category: 'Economy',
    heatScore: 62,
    commentCount: 89,
    viewCount: 5200,
    submittedByName: 'Jordan K.',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    status: 'processed',
    perspectives: buildPerspectives('c2'),
  },
  {
    id: 'c3',
    text: 'Ultra-processed food consumption is the primary driver of the modern mental health crisis.',
    category: 'Health',
    heatScore: 55,
    commentCount: 67,
    viewCount: 3100,
    submittedByName: 'Sam R.',
    createdAt: new Date(Date.now() - 14400000).toISOString(),
    status: 'processed',
    perspectives: buildPerspectives('c3'),
  },
  {
    id: 'c4',
    text: 'The 2008 financial crisis was caused primarily by deregulation, not individual irresponsibility.',
    category: 'History',
    heatScore: 91,
    commentCount: 203,
    viewCount: 12000,
    submittedByName: 'Morgan L.',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    status: 'processed',
    perspectives: buildPerspectives('c4'),
  },
  {
    id: 'c5',
    text: 'Remote work has permanently shifted the balance of power from employers to employees.',
    category: 'Economy',
    heatScore: 38,
    commentCount: 34,
    viewCount: 1800,
    submittedByName: 'Casey T.',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    status: 'processed',
    perspectives: buildPerspectives('c5'),
  },
];

function buildPerspectives(claimId: string) {
  return [
    {
      type: 'left',
      label: 'Left Perspective',
      summary: 'Structural and systemic factors drive this issue, requiring collective solutions.',
      analysis: 'From a progressive standpoint, this phenomenon reflects deeper systemic inequalities embedded in our institutions. The root causes are structural rather than individual, shaped by decades of policy decisions that have concentrated power and resources among elites. Addressing this requires robust regulatory frameworks, democratic accountability, and investment in public infrastructure.',
      sources: [
        { title: 'The Guardian: Structural Analysis', url: '', domain: 'theguardian.com' },
        { title: 'Jacobin: Power and Policy', url: '', domain: 'jacobin.com' },
      ],
    },
    {
      type: 'right',
      label: 'Right Perspective',
      summary: 'Individual freedom and market mechanisms offer the most effective solutions.',
      analysis: 'Conservative analysts emphasize that free markets and individual responsibility remain the most efficient mechanisms for addressing complex social problems. Government intervention often creates unintended consequences, distorting incentives and reducing overall prosperity. Personal agency and voluntary cooperation produce better outcomes than top-down mandates.',
      sources: [
        { title: 'Wall Street Journal: Market Forces', url: '', domain: 'wsj.com' },
        { title: 'Heritage Foundation: Policy Brief', url: '', domain: 'heritage.org' },
      ],
    },
    {
      type: 'historical',
      label: 'Historical Context',
      summary: 'Historical precedents reveal recurring patterns that illuminate the present debate.',
      analysis: 'Examining the historical record reveals that this debate has deep roots. Similar tensions emerged during the Industrial Revolution, the Progressive Era, and the post-WWII economic boom. Each period produced competing narratives that reflected the interests and values of their time. What appears new often recapitulates older conflicts in modern form.',
      sources: [
        { title: 'Howard Zinn: A People\'s History', url: '', domain: 'archive.org' },
        { title: 'American Historical Review', url: '', domain: 'academic.oup.com' },
      ],
    },
    {
      type: 'scientific',
      label: 'Scientific View',
      summary: 'Peer-reviewed research presents a nuanced, data-driven picture of the evidence.',
      analysis: 'The empirical literature on this topic is mixed. Meta-analyses suggest modest but statistically significant effects in controlled settings. However, observational studies face methodological challenges including selection bias and confounding variables. Leading researchers emphasize that correlation does not imply causation, and that effect sizes in real-world conditions may differ substantially from laboratory findings.',
      sources: [
        { title: 'Nature: Systematic Review (2023)', url: '', domain: 'nature.com' },
        { title: 'MIT Media Lab Research', url: '', domain: 'media.mit.edu' },
        { title: 'Pew Research Center: Data Analysis', url: '', domain: 'pewresearch.org' },
      ],
    },
    {
      type: 'contrarian',
      label: 'Contrarian View',
      summary: 'The conventional wisdom on this issue may be fundamentally mistaken.',
      analysis: 'The contrarian case challenges assumptions shared by both sides of the mainstream debate. What if the problem is misdiagnosed, the evidence misread, or the proposed solutions counterproductive? Heterodox thinkers argue that popular narratives are driven more by cognitive biases and social incentives than by rigorous analysis. The most important insights often come from questioning what everyone "knows" to be true.',
      sources: [
        { title: 'Nassim Taleb: Antifragile', url: '', domain: 'archive.org' },
      ],
      isPremiumOnly: true,
    },
  ];
}

const claimMap = new Map(MOCK_CLAIMS.map(c => [c.id, c]));
let claimCounter = 100;

app.get('/api/claims/trending', (_req, res) => {
  const list = [...claimMap.values()].map(c => ({
    ...c,
    perspectives: [],
  }));
  res.json(list);
});

app.get('/api/claims/:id', (req, res) => {
  const claim = claimMap.get(req.params.id);
  if (!claim) { res.status(404).json({ message: 'Claim not found' }); return; }
  res.json(claim);
});

app.post('/api/claims', authMiddleware, (req: any, res) => {
  const user = users.get(req.user.id);
  if (!user) { res.status(404).json({ message: 'User not found' }); return; }

  if (user.tier === 'free' && user.checksUsedToday >= user.dailyLimit) {
    res.status(429).json({ message: 'Daily limit reached. Upgrade to Premium for unlimited checks.' }); return;
  }

  user.checksUsedToday += 1;

  const id = `c${++claimCounter}`;
  const { text, category } = req.body;

  const newClaim = {
    id,
    text,
    category,
    heatScore: Math.floor(Math.random() * 80) + 10,
    commentCount: 0,
    viewCount: 1,
    submittedByName: user.displayName,
    createdAt: new Date().toISOString(),
    status: 'processed' as const,
    perspectives: buildPerspectives(id),
  };

  claimMap.set(id, newClaim);
  res.status(202).json({ id });
});

// ─── Comments ────────────────────────────────────────────────────────────────

app.get('/api/claims/:id/comments', (req, res) => {
  const comments = commentsByClaimId.get(req.params.id) ?? [];
  res.json(comments.map(c => ({
    id: c.id,
    claimId: c.claimId,
    userId: c.userId,
    userDisplayName: c.userDisplayName,
    text: c.text,
    likes: c.likes,
    isLiked: false,
    createdAt: c.createdAt,
  })));
});

app.post('/api/claims/:id/comments', authMiddleware, (req: any, res) => {
  const user = users.get(req.user.id);
  if (!user) { res.status(404).json({ message: 'Not found' }); return; }

  const comment: Comment = {
    id: uid(),
    claimId: req.params.id,
    userId: user.id,
    userDisplayName: user.displayName,
    text: req.body.text,
    likes: 0,
    likedBy: new Set(),
    createdAt: new Date().toISOString(),
  };

  const list = commentsByClaimId.get(req.params.id) ?? [];
  list.unshift(comment);
  commentsByClaimId.set(req.params.id, list);

  res.status(201).json({ ...comment, likedBy: undefined, isLiked: false });
});

app.post('/api/claims/:id/comments/:commentId/like', authMiddleware, (req: any, res) => {
  const list = commentsByClaimId.get(req.params.id) ?? [];
  const comment = list.find(c => c.id === req.params.commentId);
  if (!comment) { res.status(404).json({ message: 'Comment not found' }); return; }

  if (comment.likedBy.has(req.user.id)) {
    comment.likedBy.delete(req.user.id);
    comment.likes = Math.max(0, comment.likes - 1);
    res.json({ liked: false });
  } else {
    comment.likedBy.add(req.user.id);
    comment.likes += 1;
    res.json({ liked: true });
  }
});

// ─── Stripe stubs (so app doesn't crash) ────────────────────────────────────

app.post('/api/stripe/create-checkout', authMiddleware, (_req, res) => {
  res.json({ url: 'https://checkout.stripe.com/test' });
});

app.post('/api/stripe/webhook', (_req, res) => res.json({ received: true }));

// ─── Start ───────────────────────────────────────────────────────────────────

async function seedTestUser() {
  const passwordHash = await bcrypt.hash('Test1234', 10);
  const testUser: User = {
    id: 'test-user-001',
    email: 'test@test.com',
    displayName: 'Test User',
    passwordHash,
    tier: 'premium',
    checksUsedToday: 0,
    dailyLimit: 999,
    createdAt: new Date().toISOString(),
  };
  users.set(testUser.id, testUser);
}

seedTestUser().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Reality Check LOCAL server running on http://localhost:${PORT}`);
    console.log(`📦 In-memory database — data resets on restart`);
    console.log(`\nTest account: test@test.com / Test1234\n`);
  });
});
