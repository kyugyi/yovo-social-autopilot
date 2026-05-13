import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const APP = process.env.APP || 'yovo';
const YOVO_LLMS_URL = 'https://app-yovo.com/llms-full.txt';

export async function loadBrand() {
  const brandPath = path.join(ROOT, 'data', 'brand.json');
  const raw = await fs.readFile(brandPath, 'utf-8');
  return JSON.parse(raw);
}

export async function fetchLiveContext({ timeoutMs = 10_000 } = {}) {
  if (APP !== 'yovo') {
    return { source: 'none', text: '', note: `No live context URL configured for APP=${APP}` };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(YOVO_LLMS_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return { source: YOVO_LLMS_URL, text, fetched_at: new Date().toISOString() };
  } catch (err) {
    return { source: YOVO_LLMS_URL, text: '', error: String(err) };
  } finally {
    clearTimeout(timeout);
  }
}
