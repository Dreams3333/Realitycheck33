import Anthropic from '@anthropic-ai/sdk';
import { Source } from '../types/index.js';

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export interface GeneratedPerspective {
  type: 'left' | 'right' | 'historical' | 'scientific' | 'contrarian';
  label: string;
  summary: string;
  analysis: string;
  sources: Source[];
  isPremiumOnly: boolean;
}

const PERSPECTIVE_PROMPTS = {
  left: 'progressive / left-leaning perspective emphasizing structural causes, inequality, systemic factors, and government solutions',
  right: 'conservative / right-leaning perspective emphasizing individual responsibility, free markets, tradition, and limited government',
  historical: 'historical context — what historical precedents, events, and patterns are relevant? How has this issue evolved over time?',
  scientific: 'data-driven and scientific perspective — what does peer-reviewed research, empirical data, and expert consensus say?',
  contrarian: 'contrarian or devil\'s advocate view — what is the strongest case against the conventional wisdom? What are people missing?',
};

function mockPerspectives(claimText: string, isPremium: boolean): GeneratedPerspective[] {
  const types: Array<GeneratedPerspective['type']> = isPremium
    ? ['left', 'right', 'historical', 'scientific', 'contrarian']
    : ['left', 'right', 'historical', 'scientific'];

  const labels: Record<GeneratedPerspective['type'], string> = {
    left: 'Progressive Perspective',
    right: 'Conservative Perspective',
    historical: 'Historical Context',
    scientific: 'Scientific Consensus',
    contrarian: 'Contrarian View',
  };

  return types.map((type) => ({
    type,
    label: labels[type],
    summary: `A ${type} analysis of: "${claimText.slice(0, 60)}..."`,
    analysis: `This is a placeholder analysis for the ${type} perspective. Add your ANTHROPIC_API_KEY to Vercel environment variables to enable real AI-generated perspectives from Claude.\n\nOnce configured, this section will contain 2-3 paragraphs of substantive, nuanced analysis from the ${type} viewpoint, drawing on relevant data, historical precedent, and expert opinion.\n\nThe analysis will be tailored specifically to the claim submitted and provide genuine insight across the political and analytical spectrum.`,
    sources: [{ title: 'Add ANTHROPIC_API_KEY to enable real sources', url: 'https://console.anthropic.com', domain: 'anthropic.com' }],
    isPremiumOnly: type === 'contrarian',
  }));
}

export async function generatePerspectives(
  claimText: string,
  category: string,
  isPremium: boolean
): Promise<GeneratedPerspective[]> {
  if (!client) return mockPerspectives(claimText, isPremium);

  const perspectiveTypes = isPremium
    ? (['left', 'right', 'historical', 'scientific', 'contrarian'] as const)
    : (['left', 'right', 'historical', 'scientific'] as const);

  const prompt = `Analyze this claim from ${perspectiveTypes.length} perspectives. Be concise and sharp.

CLAIM: "${claimText}"
CATEGORY: ${category}

PERSPECTIVES: ${perspectiveTypes.map(t => `${t.toUpperCase()}: ${PERSPECTIVE_PROMPTS[t]}`).join(' | ')}

Return a JSON array. Each element:
- type: the perspective key (lowercase)
- label: display name (e.g. "Left Perspective")
- summary: one punchy sentence, max 100 chars
- analysis: one focused paragraph, max 80 words, no fluff
- sources: 1-2 objects with { title, url, domain } — real sources only

ONLY return the JSON array, nothing else.`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude');

  // Strip markdown code fences if present
  const jsonText = content.text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  let raw: Array<{
    type: GeneratedPerspective['type'];
    label: string;
    summary: string;
    analysis: string;
    sources: Source[];
  }>;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    console.error('Claude JSON parse failed. Raw response:', content.text.slice(0, 500));
    throw new Error('Claude returned non-JSON response');
  }

  return raw.map((p) => ({
    ...p,
    isPremiumOnly: p.type === 'contrarian',
  }));
}

export async function calculateHeatScore(claimText: string): Promise<number> {
  if (!client) return Math.floor(Math.random() * 40) + 40; // mock: 40-80

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 10,
    messages: [
      {
        role: 'user',
        content: `Rate the political/social controversy level of this claim on a scale of 0-100, where 0 is non-controversial and 100 is extremely divisive. Respond with ONLY a number.

CLAIM: "${claimText}"`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') return 50;
  const score = parseInt(content.text.trim(), 10);
  return isNaN(score) ? 50 : Math.max(0, Math.min(100, score));
}
