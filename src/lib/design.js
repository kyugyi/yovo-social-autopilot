/**
 * Yovo design system — seed → spec decomposition.
 *
 *   seed in [0, N-1] where N = layouts × themes × variations = 1000
 *
 * Decomposition (matches data/design-system.json _meta):
 *   layout_index    = seed % L
 *   theme_index     = floor(seed / L) % T
 *   variation_index = floor(seed / (L*T)) % V
 *
 * Two seeds produce identical designs iff they map to the same (L,T,V) tuple.
 * In the default config there's no aliasing — every seed in [0,999] is unique.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SPEC_PATH = path.join(ROOT, 'data', 'design-system.json');

let _cache = null;

export async function loadSpec() {
  if (_cache) return _cache;
  const raw = await fs.readFile(SPEC_PATH, 'utf-8');
  _cache = JSON.parse(raw);
  return _cache;
}

export async function totalDesigns() {
  const spec = await loadSpec();
  return spec.layouts.length * spec.themes.length * spec.variations.length;
}

export async function decomposeSeed(seed) {
  if (!Number.isInteger(seed) || seed < 0) {
    throw new Error(`Invalid seed ${seed}: must be a non-negative integer`);
  }
  const spec = await loadSpec();
  const L = spec.layouts.length;
  const T = spec.themes.length;
  const V = spec.variations.length;
  const total = L * T * V;
  if (seed >= total) {
    throw new Error(`Seed ${seed} out of range [0, ${total - 1}]`);
  }
  const layout = spec.layouts[seed % L];
  const theme = spec.themes[Math.floor(seed / L) % T];
  const variation = spec.variations[Math.floor(seed / (L * T)) % V];
  return { seed, layout, theme, variation };
}
