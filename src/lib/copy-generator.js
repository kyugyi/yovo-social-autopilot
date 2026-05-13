/**
 * Copy generator.
 *
 * Two modes:
 *
 *  - ROUTINE mode (default in the cloud routine): Claude itself generates the
 *    hook / resolution / caption / hashtags by following CLAUDE.md, then calls
 *    src/main.js with the values already filled in (env vars or CLI args). In
 *    that case this module is not invoked at all.
 *
 *  - LOCAL mode (when running `npm run dry-run` on your Mac): we call the
 *    Anthropic API directly. Requires ANTHROPIC_API_KEY in env.
 *
 * The output schema is always:
 *   { hook, resolution, caption_en, caption_fr?, hashtags: string[] }
 */

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';

function buildPrompt({ angle, brand, liveContext, dayHint }) {
  const voiceDo = brand.voice.do.join(', ');
  const voiceDont = brand.voice.dont.join(', ');

  return `You are the daily content generator for ${brand.instagram_handle} on Instagram.

App context (canonical):
${liveContext?.text?.slice(0, 4000) || '(no live context fetched)'}

Brand voice:
- Tone: ${brand.voice.tone}
- DO: ${voiceDo}
- DON'T: ${voiceDont}
- Manifesto: ${brand.manifesto}
- Rule: ${brand.rule}

Today's angle:
- id: ${angle.id}
- type: ${angle.type}
- theme: ${angle.theme}
- seed_concept: ${angle.seed_concept}
- day-hint: ${dayHint || 'midweek'}

Produce a JSON object with EXACTLY this shape — no prose, no markdown, no code fences:

{
  "hook": "max 7 words, blunt, English. Goes on Image 1.",
  "resolution": "1-2 short lines, Yovo's answer. Goes on Image 2. Max 80 characters total.",
  "caption_en": "50-80 words English. Soft CTA mentioning the App Store. Max ONE emoji or none.",
  "caption_fr": "50-80 words French translation. Soft CTA. Max ONE emoji or none.",
  "hashtags": ["#tag1", "#tag2", "..."]
}

Hard rules:
- NEVER reuse a hook verbatim from prior posts.
- NEVER invent features Yovo doesn't have.
- NEVER use emojis in 'hook' or 'resolution'.
- NEVER use exclamation marks anywhere.
- ALWAYS stay sober, direct, anti-fluff.
- 8 to 12 hashtags, mix niche (#minimalisttodo, #onelistaday, #lessismore) and broader (#productivity, #iosapp, #focus).

Return the JSON object only.`;
}

export async function generateCopy({ angle, brand, liveContext, dayHint }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not set. In LOCAL mode, set it in your .env. ' +
      'In ROUTINE mode, Claude itself generates copy via CLAUDE.md — do not call this module.'
    );
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const prompt = buildPrompt({ angle, brand, liveContext, dayHint });

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = res.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
    .trim();

  // Robust JSON extraction (strip code fences if model added them).
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`Copy generator did not return JSON. Raw output:\n${text}`);
  }
  const json = text.slice(jsonStart, jsonEnd + 1);

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`Copy generator returned invalid JSON: ${err.message}\nRaw:\n${json}`);
  }

  if (!parsed.hook || !parsed.resolution || !parsed.caption_en || !Array.isArray(parsed.hashtags)) {
    throw new Error(`Copy generator JSON missing required fields. Got: ${JSON.stringify(parsed)}`);
  }

  return parsed;
}
