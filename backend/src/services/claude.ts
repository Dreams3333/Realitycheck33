import Anthropic from '@anthropic-ai/sdk';
import { Source } from '../types/index.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

export async function generatePerspectives(
  claimText: string,
  category: string,
  isPremium: boolean
): Promise<GeneratedPerspective[]> {
  const perspectiveTypes = isPremium
    ? (['left', 'right', 'historical', 'scientific', 'contrarian'] as const)
    : (['left', 'right', 'historical', 'scientific'] as const);

  const prompt = `You are an expert analytical journalist tasked with providing multiple balanced perspectives on a claim or topic.

CLAIM: "${claimText}"
CATEGORY: ${category}

For each of the following perspectives, provide a structured analysis. Be factual, nuanced, and cite real sources where possible.

PERSPECTIVES TO ANALYZE:
${perspectiveTypes.map((t, i) => `${i + 1}. ${t.toUpperCase()}: ${PERSPECTIVE_PROMPTS[t]}`).join('\n')}

Respond with a JSON array. Each element must have:
- type: one of the perspective type strings above
- label: a display label (e.g. "Left Perspective")
- summary: one sentence capturing the core argument (max 120 chars)
- analysis: 2-3 paragraphs of substantive analysis (300-500 words)
- sources: array of up to 4 objects with { title, url, domain } — use real publications/studies

Respond with ONLY the JSON array, no other text.`;

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude');

  const raw = JSON.parse(content.text) as Array<{
    type: GeneratedPerspective['type'];
    label: string;
    summary: string;
    analysis: string;
    sources: Source[];
  }>;

  return raw.map((p) => ({
    ...p,
    isPremiumOnly: p.type === 'contrarian',
  }));
}

export async function calculateHeatScore(claimText: string): Promise<number> {
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
