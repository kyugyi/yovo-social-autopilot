import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCarousel } from '../src/lib/render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const samples = [
  {
    theme: 'yovo_green',
    hook: "Stop replanning. Start moving.",
    resolution: "One list a day. Max 4 tasks. 24 hours each."
  },
  {
    theme: 'winter_ark',
    hook: "Tomorrow doesn't exist yet.",
    resolution: "Today is the only day you can act on."
  },
  {
    theme: 'classy',
    hook: "5 apps. 0 finished tasks.",
    resolution: "Yovo: one app, one list, four lines."
  }
];

async function main() {
  for (const sample of samples) {
    const outDir = path.join(ROOT, 'outputs', '_test', sample.theme);
    console.log(`[test-render] theme=${sample.theme} → ${outDir}`);
    const files = await renderCarousel({
      theme: sample.theme,
      hook: sample.hook,
      resolution: sample.resolution,
      outDir
    });
    console.log('  rendered:', files.map(f => path.relative(ROOT, f)).join(', '));
  }
  console.log('\n[test-render] done. Open the PNGs in outputs/_test/ to validate.');
}

main().catch(err => {
  console.error('[test-render] failed:', err);
  process.exit(1);
});
