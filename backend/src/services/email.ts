import nodemailer from 'nodemailer';
import { query } from '../db/index.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface DigestClaim {
  text: string;
  category: string;
  heat_score: number;
  comment_count: number;
}

export async function sendWeeklyDigest(): Promise<void> {
  const users = await query<{ email: string; display_name: string; tier: string }>(
    'SELECT email, display_name, tier FROM users WHERE created_at > NOW() - INTERVAL \'30 days\''
  );

  const topClaims = await query<DigestClaim>(
    `SELECT c.text, c.category, c.heat_score, COUNT(cm.id) as comment_count
     FROM claims c
     LEFT JOIN comments cm ON cm.claim_id = c.id
     WHERE c.created_at > NOW() - INTERVAL '7 days' AND c.status = 'processed'
     GROUP BY c.id
     ORDER BY c.heat_score DESC, comment_count DESC
     LIMIT 5`
  );

  for (const user of users) {
    const html = buildDigestEmail(user.display_name, user.tier === 'premium', topClaims);
    await transporter.sendMail({
      from: `Reality Check <${process.env.EMAIL_FROM}>`,
      to: user.email,
      subject: "This week's most contested claims",
      html,
    });
  }
}

function buildDigestEmail(name: string, isPremium: boolean, claims: DigestClaim[]): string {
  const claimsHtml = claims
    .map(
      (c, i) => `
    <div style="margin-bottom:20px;padding:16px;background:#1A1A1A;border-radius:12px;border:1px solid ${getHeatColor(c.heat_score)}22;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="background:#1E1E1E;color:${getHeatColor(c.heat_score)};padding:3px 8px;border-radius:20px;font-size:11px;font-weight:700;border:1px solid ${getHeatColor(c.heat_score)};">${c.category}</span>
        <span style="color:${getHeatColor(c.heat_score)};font-size:11px;">● ${getHeatLabel(c.heat_score)}</span>
      </div>
      <p style="color:#FFFFFF;font-size:15px;font-weight:600;margin:0 0 8px 0;">${i + 1}. ${c.text}</p>
      <p style="color:#606060;font-size:12px;margin:0;">${c.comment_count} people discussing</p>
    </div>`
    )
    .join('');

  const ctaSection = isPremium
    ? `<p style="color:#9A9A9A;text-align:center;font-size:13px;">You're a Premium member. Thank you for your support.</p>`
    : `
    <div style="text-align:center;margin:32px 0;">
      <a href="${process.env.APP_URL}/premium" style="background:#FFD700;color:#000;padding:14px 32px;border-radius:10px;font-weight:800;font-size:15px;text-decoration:none;display:inline-block;">
        ★ Upgrade to Premium — $4.99/mo
      </a>
      <p style="color:#606060;font-size:12px;margin-top:12px;">Unlimited checks · All 5 perspectives · Deep historical context</p>
    </div>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#FFFFFF;margin:0;padding:0;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:40px;">
      <h1 style="font-size:28px;font-weight:900;letter-spacing:-0.5px;margin:0;">
        REALITY <span style="color:#00A8FF;">CHECK</span>
      </h1>
      <p style="color:#505050;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:8px;">Weekly Digest</p>
    </div>

    <p style="color:#9A9A9A;font-size:15px;">Hi ${name},</p>
    <p style="color:#9A9A9A;font-size:15px;">Here are this week's 5 most contested claims — ranked by debate intensity and community engagement.</p>

    <h2 style="color:#FFFFFF;font-size:16px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:32px 0 16px;">
      Most Contested This Week
    </h2>

    ${claimsHtml}
    ${ctaSection}

    <hr style="border:none;border-top:1px solid #1E1E1E;margin:40px 0;">
    <p style="color:#303030;font-size:11px;text-align:center;">
      Reality Check · No agenda. Just angles.<br>
      <a href="#" style="color:#303030;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;
}

function getHeatColor(score: number): string {
  if (score < 35) return '#00A8FF';
  if (score < 70) return '#FF8C00';
  return '#FFD700';
}

function getHeatLabel(score: number): string {
  if (score < 35) return 'Low Debate';
  if (score < 70) return 'Contested';
  return 'Highly Contested';
}
