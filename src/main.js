/**
 * Daily orchestrator for the Yovo social autopilot.
 *
 * Two usage modes:
 *
 *  1) LOCAL dry-run (your Mac):
 *       npm run dry-run
 *     Picks an angle + a design seed, generates copy via the Anthropic API,
 *     renders the 3-slide carousel, saves outputs to outputs/{YYYY-MM-DD}/.
 *
 *  2) CLOUD ROUTINE (claude.ai/code/routines):
 *     The routine reads CLAUDE.md, picks the angle + seed and writes copy
 *     itself, then runs this script with COPY_* env vars pre-set. We skip
 *     the API call and go straight to render + publish.
 *
 *     Required env in the routine secrets:
 *       META_LONG_LIVED_TOKEN, IG_BUSINESS_ACCOUNT_ID
 *     plus, per-run, the routine sets:
 *       SEED, ANGLE_ID, COPY_HOOK, COPY_RESOLUTION, COPY_CAPTION, COPY_HASHTAGS
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { loadBrand, fetchLiveContext } from './lib/context.js';
import { pickAngle, pickSeed } from './lib/angle-picker.js';
import { renderCarousel } from './lib/render.js';
import { decomposeSeed } from './lib/design.js';
import { appendEntry } from './lib/history.js';
import { publishCarousel } from './lib/instagram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DRY_RUN = String(process.env.DRY_RUN ?? 'true').toLowerCase() === 'true';

function todayISO(tz = process.env.TIMEZONE || 'Europe/Zurich') {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return d.format(new Date());
}

function getCopyFromEnv() {
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

async function getCopyFromAPI({ angle, brand, liveContext, dayHint, design }) {
  const { generateCopy } = await import('./lib/copy-generator.js');
  return generateCopy({ angle, brand, liveContext, dayHint, design });
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

  // 2. Pick angle and design seed.
  //    If SEED is provided via env, honor it (routine mode). Otherwise pick.
  let seed, design, angleInfo;
  if (process.env.SEED) {
    seed = parseInt(process.env.SEED, 10);
    design = await decomposeSeed(seed);
    angleInfo = await pickAngle();
    console.log(`[main] seed=${seed} (from env) → layout=${design.layout.name} theme=${design.theme.name} var=${design.variation.name}`);
  } else {
    const { seed: pickedSeed, design: pickedDesign, reason: seedReason } = await pickSeed();
    seed = pickedSeed;
    design = pickedDesign;
    angleInfo = await pickAngle();
    console.log(`[main] seed=${seed} → ${design.layout.name}/${design.theme.name}/${design.variation.name} (${seedReason})`);
  }
  const { angle, dayHint, reason: angleReason } = angleInfo;
  console.log(`[main] angle=${angle.id} type=${angle.type} (${angleReason})`);

  // 3. Get copy — from env (routine mode) or API (local mode).
  let copy = getCopyFromEnv();
  let copySource = 'env';
  if (!copy) {
    console.log('[main] no COPY_* env vars; calling Anthropic API');
    copy = await getCopyFromAPI({ angle, brand, liveContext, dayHint, design });
    copySource = 'api';
  }
  console.log(`[main] copy source=${copySource}`);
  console.log(`[main]   hook="${copy.hook}"`);
  console.log(`[main]   resolution="${copy.resolution}"`);

  // 4. Render the 3-slide carousel.
  const { paths } = await renderCarousel({
    seed,
    hook: copy.hook,
    resolution: copy.resolution,
    outDir,
    hookAccent: copy.hook_accent,
    resolutionAccent: copy.resolution_accent
  });
  const [hookPng, resolutionPng, ctaPng] = paths;
  console.log(`[main] rendered 3 slides:`);
  for (const p of paths) console.log(`         - ${path.relative(ROOT, p)}`);

  const caption = composeCaption(copy, brand);

  const meta = {
    date,
    seed,
    layout: design.layout.name,
    theme: design.theme.name,
    variation: design.variation.name,
    angle_id: angle.id,
    type: angle.type,
    hook: copy.hook,
    resolution: copy.resolution,
    caption,
    hashtags: copy.hashtags,
    files: {
      hook: path.relative(ROOT, hookPng),
      resolution: path.relative(ROOT, resolutionPng),
      cta: path.relative(ROOT, ctaPng)
    },
    dry_run: DRY_RUN,
    copy_source: copySource
  };

  await fs.writeFile(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf-8');
  await fs.writeFile(path.join(outDir, 'caption.txt'), caption + '\n', 'utf-8');

  // 5. Publish or stop.
  if (DRY_RUN) {
    console.log(`[main] DRY_RUN=true → outputs saved to ${path.relative(ROOT, outDir)}/`);
    console.log('[main] review the 3 PNGs + caption.txt + meta.json. Set DRY_RUN=false to actually publish.');
    return;
  }

  const imageUrls = (process.env.PUBLIC_IMAGE_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (imageUrls.length < 3) {
    throw new Error(
      'DRY_RUN=false but PUBLIC_IMAGE_URLS is missing or has fewer than 3 URLs. ' +
      'In the routine, the publish step needs the three PNGs publicly hosted; ' +
      'pass them comma-separated (hook,resolution,cta).'
    );
  }

  const result = await publishCarousel({ imageUrls, caption, dryRun: false });
  console.log(`[main] published. instagram_post_id=${result.instagram_post_id}`);

  await appendEntry({
    date,
    seed,
    layout: design.layout.name,
    theme: design.theme.name,
    variation: design.variation.name,
    angle_id: angle.id,
    type: angle.type,
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
