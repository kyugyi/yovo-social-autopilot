import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const TEMPLATE_DIR = path.join(ROOT, 'src', 'templates');

async function loadTemplate(name) {
  const html = await fs.readFile(path.join(TEMPLATE_DIR, name), 'utf-8');
  const css = await fs.readFile(path.join(TEMPLATE_DIR, 'shared', 'styles.css'), 'utf-8');
  return html.replaceAll('{{STYLES}}', css);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function renderOne(page, templateName, replacements, outPath) {
  let html = await loadTemplate(templateName);
  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.evaluateHandle('document.fonts.ready');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await page.screenshot({ path: outPath, omitBackground: false, type: 'png' });
  return outPath;
}

export async function renderCarousel({ theme, hook, resolution, outDir }) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--font-render-hinting=none'],
    defaultViewport: { width: 1080, height: 1350, deviceScaleFactor: 1 }
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });

    const hookPath = path.join(outDir, '01-hook.png');
    const resolutionPath = path.join(outDir, '02-resolution.png');

    await renderOne(page, 'hook.html', {
      THEME: theme,
      HOOK_TEXT: escapeHtml(hook)
    }, hookPath);

    await renderOne(page, 'resolution.html', {
      THEME: theme,
      RESOLUTION_TEXT: escapeHtml(resolution)
    }, resolutionPath);

    return [hookPath, resolutionPath];
  } finally {
    await browser.close();
  }
}
