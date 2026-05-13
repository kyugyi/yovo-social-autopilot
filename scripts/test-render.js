import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCarousel } from '../src/lib/render.js';
import { totalDesigns, decomposeSeed } from '../src/lib/design.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Hand-picked seeds to cover the design space:
//  - Every layout family at least once
//  - All 5 themes appear
//  - A few variations sprinkled in
const samples = [
  { seed: 0,   hook: "Stop replanning. Start moving.",        resolution: "One list a day. Max 4 tasks." },
  { seed: 1,   hook: "Tomorrow doesn't exist yet.",           resolution: "Today is the only day you act on." },
  { seed: 2,   hook: "Yesterday won't come back.",            resolution: "The archive eats what wasn't done." },
  { seed: 3,   hook: "Four tasks. 24 hours.",                  resolution: "Then archive. That's it." },
  { seed: 4,   hook: "Less app, more done.",                   resolution: "Yovo gives your time back." },
  { seed: 25,  hook: "Endless lists. Endless paralysis.",     resolution: "Four lines. Today. That's the cap." },
  { seed: 47,  hook: "5 apps. 0 finished tasks.",              resolution: "Yovo: one app, one list, four lines." },
  { seed: 68,  hook: "Discipline is daily, not someday.",     resolution: "Open Yovo. Write 4 lines. Close." },
  { seed: 89,  hook: "Imagined in Switzerland.",                resolution: "Coded in Boston. Free on iOS." },
  { seed: 110, hook: "Action beats planning.",                 resolution: "Stop scheduling next week." },
  { seed: 234, hook: "Hard tasks first.",                       resolution: "The list doesn't grow." },
  { seed: 567, hook: "Empty slots are not failure.",           resolution: "They are space to breathe." }
];

async function main() {
  console.log(`[test-render] Total unique designs available: ${await totalDesigns()}`);
  console.log(`[test-render] Rendering ${samples.length} sample carousels...\n`);

  for (const sample of samples) {
    const spec = await decomposeSeed(sample.seed);
    const outDir = path.join(ROOT, 'outputs', '_test', `seed-${String(sample.seed).padStart(3, '0')}`);
    console.log(`  seed=${sample.seed} → layout=${spec.layout.name}  theme=${spec.theme.name}  var=${spec.variation.name}`);
    await renderCarousel({
      seed: sample.seed,
      hook: sample.hook,
      resolution: sample.resolution,
      outDir
    });
  }

  console.log(`\n[test-render] Done. Browse outputs/_test/seed-XXX/ to validate.`);
}

main().catch(err => {
  console.error('[test-render] failed:', err);
  process.exit(1);
});
