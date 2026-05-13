import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readHistory, recentAngleIds, lastEntry } from './history.js';

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

export async function pickAngle({ today = new Date() } = {}) {
  const angles = await loadAngles();
  const history = await readHistory();
  const blocked = recentAngleIds(history, 14);
  const last = lastEntry(history);
  const lastType = last?.type;

  const candidates = angles.filter(a => !blocked.has(a.id));
  if (candidates.length === 0) {
    return { angle: angles[Math.floor(Math.random() * angles.length)], reason: 'fallback: all angles used in last 14 days' };
  }

  const differentType = candidates.filter(a => a.type !== lastType);
  const pool = differentType.length > 0 ? differentType : candidates;

  const idx = Math.floor(Math.random() * pool.length);
  const angle = pool[idx];

  return {
    angle,
    reason: `picked from ${pool.length} candidates (blocked: ${blocked.size}, day-hint: ${dayHint(today)})`,
    dayHint: dayHint(today)
  };
}
