import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const HISTORY_PATH = path.join(ROOT, 'data', 'posted-history.json');

export async function readHistory() {
  try {
    const raw = await fs.readFile(HISTORY_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function appendEntry(entry) {
  const entries = await readHistory();
  entries.push(entry);
  await fs.writeFile(HISTORY_PATH, JSON.stringify({ entries }, null, 2) + '\n', 'utf-8');
  return entry;
}

export function recentAngleIds(entries, days = 14) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Set(
    entries
      .filter(e => new Date(e.date).getTime() >= cutoff)
      .map(e => e.angle_id)
  );
}

export function lastEntry(entries) {
  if (!entries.length) return null;
  return [...entries].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
}
