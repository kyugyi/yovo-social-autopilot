/**
 * Daily orchestrator for the Yovo social autopilot.
 *
 * Two usage modes:
 *
 *  1) LOCAL dry-run (your Mac):
 *       npm run dry-run
 *     Picks an angle, generates copy via Anthropic API, renders the carousel,
 *     saves outputs to outputs/{YYYY-MM-DD}/ and writes meta.json.
 *
 *  2) CLOUD ROUTINE (claude.ai/code/routines):
 *     The routine reads CLAUDE.md, picks an angle and writes the copy itself,
 *     then runs this script with COPY_* env vars pre-set. We skip the API call
 *     in that case and go straight to render + publish.
 *
 *     Required env in the routine secrets:
 *       META_LONG_LIVED_TOKEN, IG_BUSINESS_ACCOUNT_ID
 *     plus, per-run, the routine sets:
 *       ANGLE_ID, THEME, COPY_HOOK, COPY_RESOLUTION, COPY_CAPTION, COPY_HASHTAGS
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { loadBrand, fetchLiveContext } from './lib/context.js';
import { pickAngle } from './lib/angle-picker.js';
import { renderCarousel } from './lib/render.js';
import { appendEntry } from './lib/history.js';
import { publishCarousel } from './lib/instagram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DRY_RUN = String(process.env.DRY_RUN ?? 'true').toLowerCase() === 'true';

function todayISO(tz = process.env.TIMEZONE || 'Europe/Zurich') {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return d.format(new Date());
}

async function getCopyFromEnv() {
  const hook = process.env.COPY_HOOK;
  const resolution = process.env.COPY_RESOLUTION;
  const caption = process.env.COPY_CAPTION;
  const hashtagsRaw = process.env.COPY_HASHTAGS;
  if (!hook || !resolution || !caption) return null;
  let hashtags = [];
  if (hashtagsRaw) {
    hashtags = hashtagsRaw.split(/[\s,]+/).filter(Boolean).map(t => t.startsWith('#') ? t : `#${t}`);
  }
  return { hook, resolution, caption_en: caption, hashtags };
}

async function getCopyFromAPI({ angle, brand, liveContext, dayHint }) {
  const { generateCopy } = await import('./lib/copy-generator.js');
  return generateCopy({ angle, brand, liveContext, dayHint });
}

function composeCaption(copy, brand) {
  const parts = [copy.caption_en];
  if (copy.caption_fr) {
    parts.push('');
    parts.push(copy.caption_fr);
  }
  parts.push('');
  parts.push(`→ ${brand.appstore}`);
  parts.push('');
  parts.push(copy.hashtags.join(' '));
  return parts.join('\n');
}

async function main() {
  const date = todayISO();
  const outDir = path.join(ROOT, 'outputs', date);
  await fs.mkdir(outDir, { recursive: true });

  console.log(`[main] date=${date} DRY_RUN=${DRY_RUN}`);

  // 1. Load brand + live context.
  const brand = await loadBrand();
  const liveContext = await fetchLiveContext();
  console.log(`[main] brand=${brand.name} liveContext=${liveContext.text ? 'fetched' : 'unavailable'}`);

  // 2. Pick angle.
  const { angle, reason, dayHint } = await pickAngle({ today: new Date() });
  console.log(`[main] angle=${angle.id} type=${angle.type} theme=${angle.theme} (${reason})`);

  // 3. Get copy — from env (routine mode) or API (local mode).
  let copy = await getCopyFromEnv();
  let copySource = 'env';
  if (!copy) {
    console.log('[main] no COPY_* env vars; falling back to Anthropic API');
    copy = await getCopyFromAPI({ angle, brand, liveContext, dayHint });
    copySource = 'api';
  }
  console.log(`[main] copy source=${copySource}`);
  console.log(`[main]   hook="${copy.hook}"`);
  console.log(`[main]   resolution="${copy.resolution}"`);

  // 4. Render.
  const [hookPng, resolutionPng] = await renderCarousel({
    theme: angle.theme,
    hook: copy.hook,
    resolution: copy.resolution,
    outDir
  });
  console.log(`[main] rendered → ${path.relative(ROOT, hookPng)}, ${path.relative(ROOT, resolutionPng)}`);

  const caption = composeCaption(copy, brand);

  const meta = {
    date,
    angle_id: angle.id,
    type: angle.type,
    theme: angle.theme,
    hook: copy.hook,
    resolution: copy.resolution,
    caption,
    hashtags: copy.hashtags,
    files: { hook: path.relative(ROOT, hookPng), resolution: path.relative(ROOT, resolutionPng) },
    dry_run: DRY_RUN,
    copy_source: copySource
  };

  await fs.writeFile(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf-8');
  await fs.writeFile(path.join(outDir, 'caption.txt'), caption + '\n', 'utf-8');

  // 5. Publish or stop.
  if (DRY_RUN) {
    console.log(`[main] DRY_RUN=true → outputs saved to ${path.relative(ROOT, outDir)}/`);
    console.log('[main] review the PNGs + caption.txt + meta.json. Set DRY_RUN=false to actually publish.');
    return;
  }

  const imageUrls = (process.env.PUBLIC_IMAGE_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (imageUrls.length < 2) {
    throw new Error(
      'DRY_RUN=false but PUBLIC_IMAGE_URLS is missing. ' +
      'In the routine, the publish step needs the two PNGs publicly hosted; ' +
      'pass them as a comma-separated env var (e.g. via GitHub Pages or signed-URL bucket).'
    );
  }

  const result = await publishCarousel({ imageUrls, caption, dryRun: false });
  console.log(`[main] published. instagram_post_id=${result.instagram_post_id}`);

  await appendEntry({
    date,
    angle_id: angle.id,
    type: angle.type,
    theme: angle.theme,
    hook: copy.hook,
    resolution: copy.resolution,
    caption_first_line: (copy.caption_en || '').split('\n')[0].slice(0, 140),
    instagram_post_id: result.instagram_post_id,
    dry_run: false
  });

  console.log('[main] history updated.');
}

main().catch(err => {
  console.error('[main] failed:', err);
  process.exit(1);
});
