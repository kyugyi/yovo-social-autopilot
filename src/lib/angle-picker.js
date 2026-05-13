/**
 * Picks today's content angle AND a unique design seed.
 *
 * Two dimensions of de-duplication:
 *   - Content angle: avoid reusing the same angle in the last 14 days.
 *   - Design seed (0..999): avoid reusing the same seed in the last 60 days,
 *     and try to avoid using the same layout twice in 7 days or the same theme
 *     two days in a row — so the visual feed stays varied.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readHistory,
  recentAngleIds,
  recentSeeds,
  recentLayouts,
  recentThemes,
  lastEntry
} from './history.js';
import { decomposeSeed, totalDesigns } from './design.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const ANGLES_PATH = path.join(ROOT, 'data', 'content-angles.json');

async function loadAngles() {
  const raw = await fs.readFile(ANGLES_PATH, 'utf-8');
  return JSON.parse(raw).angles;
}

function dayHint(date = new Date()) {
  const day = date.getDay();
  if (day === 1) return 'monday-motivation';
  if (day === 5) return 'friday-recap';
  if (day === 0 || day === 6) return 'weekend-lifestyle';
  return 'midweek';
}

function pickFrom(pool, fallback) {
  const arr = pool.length > 0 ? pool : fallback;
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function pickAngle({ today = new Date() } = {}) {
  const angles = await loadAngles();
  const history = await readHistory();
  const blocked = recentAngleIds(history, 14);
  const last = lastEntry(history);
  const lastType = last?.type;

  const candidates = angles.filter(a => !blocked.has(a.id));
  const final = candidates.length === 0 ? angles : candidates;
  const differentType = final.filter(a => a.type !== lastType);
  const pool = differentType.length > 0 ? differentType : final;
  const angle = pickFrom(pool, angles);

  return {
    angle,
    dayHint: dayHint(today),
    reason: `${pool.length} angle candidates (blocked: ${blocked.size}, day: ${dayHint(today)})`
  };
}

export async function pickSeed({ today = new Date() } = {}) {
  const total = await totalDesigns();
  const history = await readHistory();

  const usedSeeds = recentSeeds(history, 60);
  const recentLay = recentLayouts(history, 7);
  const recentThm = recentThemes(history, 3);

  // Build the candidate pool, filtered progressively.
  const allSeeds = Array.from({ length: total }, (_, i) => i);
  const notReused = allSeeds.filter(s => !usedSeeds.has(s));

  // Score seeds: prefer ones whose (layout, theme) hasn't appeared recently.
  const scored = [];
  for (const s of notReused) {
    const { layout, theme } = await decomposeSeed(s);
    let score = 0;
    if (!recentLay.has(layout.name)) score += 2;
    if (!recentThm.has(theme.name)) score += 1;
    scored.push({ seed: s, score });
  }

  const maxScore = scored.reduce((m, x) => Math.max(m, x.score), -1);
  const top = scored.filter(x => x.score === maxScore);

  if (top.length === 0) {
    // Should be unreachable, fallback to a random seed.
    const seed = Math.floor(Math.random() * total);
    return { seed, design: await decomposeSeed(seed), reason: 'fallback-random' };
  }

  const seed = top[Math.floor(Math.random() * top.length)].seed;
  return {
    seed,
    design: await decomposeSeed(seed),
    reason: `picked from ${top.length} top-scored seeds (score=${maxScore}); used recently: ${usedSeeds.size}, layouts last 7d: ${recentLay.size}, themes last 3d: ${recentThm.size}`
  };
}
