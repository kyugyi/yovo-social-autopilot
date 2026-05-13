import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decomposeSeed } from './design.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const TEMPLATE_DIR = path.join(ROOT, 'src', 'templates');

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/**
 * For layouts that benefit from a colored accent word (word_highlight, punctuated),
 * wrap the LAST word in <span class="accent-word">. Other layouts get the raw text.
 * If you want explicit control, pass an `accentWord` to renderCarousel.
 */
function withAccentWord(text, layoutName, explicitAccent) {
  const safe = escapeHtml(text);
  const wantsAccent = layoutName === 'word_highlight' || layoutName === 'punctuated';
  if (!wantsAccent) return safe;

  if (explicitAccent && text.includes(explicitAccent)) {
    const escAccent = escapeHtml(explicitAccent);
    return safe.replace(escAccent, `<span class="accent-word">${escAccent}</span>`);
  }

  const words = String(text).trim().split(/\s+/);
  if (words.length < 2) return safe;
  const lastIdx = words.length - 1;
  const last = words[lastIdx];
  const head = words.slice(0, lastIdx).join(' ');
  return `${escapeHtml(head)} <span class="accent-word">${escapeHtml(last)}</span>`;
}

async function loadTemplate(name) {
  const html = await fs.readFile(path.join(TEMPLATE_DIR, name), 'utf-8');
  const css = await fs.readFile(path.join(TEMPLATE_DIR, 'shared', 'styles.css'), 'utf-8');
  return html.replaceAll('{{STYLES}}', css);
}

async function renderSlide(page, html, replacements, outPath) {
  let h = html;
  for (const [k, v] of Object.entries(replacements)) {
    h = h.replaceAll(`{{${k}}}`, v);
  }
  await page.setContent(h, { waitUntil: 'networkidle0' });
  await page.evaluateHandle('document.fonts.ready');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await page.screenshot({ path: outPath, omitBackground: false, type: 'png' });
  return outPath;
}

/**
 * Render a 3-image carousel from a design seed.
 *
 * @param {object} args
 * @param {number} args.seed                Design seed (0..999).
 * @param {string} args.hook                Text for slide 1.
 * @param {string} args.resolution          Text for slide 2.
 * @param {string} args.outDir              Output directory (created if needed).
 * @param {string} [args.hookAccent]        Optional word from `hook` to highlight.
 * @param {string} [args.resolutionAccent]  Optional word from `resolution` to highlight.
 * @returns {Promise<string[]>}             Absolute paths to the 3 PNGs.
 */
export async function renderCarousel({ seed, hook, resolution, outDir, hookAccent, resolutionAccent }) {
  const design = await decomposeSeed(seed);
  const { layout, theme, variation } = design;

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--font-render-hinting=none'],
    defaultViewport: { width: 1080, height: 1350, deviceScaleFactor: 1 }
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });

    const universalHtml = await loadTemplate('universal.html');
    const ctaHtml = await loadTemplate('cta.html');

    const hookPath = path.join(outDir, '01-hook.png');
    const resolutionPath = path.join(outDir, '02-resolution.png');
    const ctaPath = path.join(outDir, '03-cta.png');

    const bignum = String((seed % 100) + 1).padStart(2, '0');

    // Slide 1 — Hook
    await renderSlide(page, universalHtml, {
      THEME: theme.name,
      LAYOUT: layout.name,
      VARIATION: variation.name,
      SLIDE_NO: '01',
      BIGNUM: bignum,
      BADGE: 'TODAY',
      FOOTER: 'one list a day',
      TEXT: withAccentWord(hook, layout.name, hookAccent)
    }, hookPath);

    // Slide 2 — Resolution
    await renderSlide(page, universalHtml, {
      THEME: theme.name,
      LAYOUT: layout.name,
      VARIATION: variation.name,
      SLIDE_NO: '02',
      BIGNUM: bignum,
      BADGE: 'YOVO',
      FOOTER: 'app-yovo.com',
      TEXT: withAccentWord(resolution, layout.name, resolutionAccent)
    }, resolutionPath);

    // Slide 3 — CTA (fixed layout; theme borrowed from design)
    await renderSlide(page, ctaHtml, {
      THEME: theme.name
    }, ctaPath);

    return {
      paths: [hookPath, resolutionPath, ctaPath],
      design
    };
  } finally {
    await browser.close();
  }
}
