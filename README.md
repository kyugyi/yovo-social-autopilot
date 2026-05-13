# Yovo Social Autopilot

Daily Instagram carousel autopilot for **@yovo_app**. Builds a 2-image carousel from a content-angle library, renders it brand-fidelity (HTML + Puppeteer), and publishes it at 18:00 Europe/Zurich every day.

---

## What it does

1. Picks one of 50 content angles (no repeat for 14 days)
2. Generates hook + resolution + caption + hashtags (English, with optional French)
3. Renders two 1080×1350 PNGs (Instagram 4:5 portrait) using the Yovo brand
4. Either saves locally (`DRY_RUN=true`) or publishes via the Instagram Graph API

---

## Repo layout

```
yovo-social-autopilot/
├── CLAUDE.md                  Routine brain — Claude reads this on every run
├── README.md                  ← you are here
├── package.json
├── .env.example               Copy to .env for local testing
├── .gitignore
│
├── src/
│   ├── main.js                Orchestrator entry point
│   ├── lib/
│   │   ├── context.js         Loads brand.json + fetches llms-full.txt
│   │   ├── angle-picker.js    Picks an angle (no repeats, day-of-week aware)
│   │   ├── copy-generator.js  Anthropic API call (local mode only)
│   │   ├── render.js          HTML → 1080×1350 PNG via Puppeteer
│   │   ├── instagram.js       Graph API carousel publish
│   │   └── history.js         Read/write posted-history.json
│   └── templates/
│       ├── hook.html          Image 1 template
│       ├── resolution.html    Image 2 template
│       └── shared/
│           ├── styles.css     Brand tokens (theme-driven CSS vars)
│           └── fonts/         Drop Yovo .ttf/.otf here if you have one
│
├── data/
│   ├── brand.json             Colors, themes, voice, audience
│   ├── content-angles.json    50 angles
│   └── posted-history.json    Auto-managed log
│
├── assets/
│   └── app-screens/           Drop real iOS screenshots here (future templates)
│
├── outputs/                   Generated PNGs (gitignored, kept locally)
└── scripts/
    └── test-render.js         Standalone visual test (3 themes)
```

---

## Local development

Prereqs: Node.js 20+.

```bash
git clone <repo-url>
cd yovo-social-autopilot
npm install
cp .env.example .env
# Edit .env: at minimum set ANTHROPIC_API_KEY for the copy-generator.
```

### Test the rendering only (no API call, no Instagram)

Produces 3 sample carousels (one per theme) into `outputs/_test/`:

```bash
npm run test:render
open outputs/_test/yovo_green/01-hook.png
```

### Full dry run

Picks an angle, hits the Anthropic API for copy, renders the carousel, saves to `outputs/{YYYY-MM-DD}/`. **Does not publish.**

```bash
npm run dry-run
```

Outputs:

- `outputs/{date}/01-hook.png`
- `outputs/{date}/02-resolution.png`
- `outputs/{date}/caption.txt`
- `outputs/{date}/meta.json`

---

## Cloud routine (production)

The routine runs daily at 18:00 Europe/Zurich on `claude.ai/code/routines`. See [SETUP.md](./SETUP.md) for the full step-by-step (Meta setup, routine creation, secrets) — or scroll down.

### Required secrets (paste into the routine's Secrets UI, not the repo)

| Name | Where to get it |
|---|---|
| `META_LONG_LIVED_TOKEN` | Meta Developer dashboard → your app → Instagram Graph API |
| `IG_BUSINESS_ACCOUNT_ID` | Same dashboard, after linking the FB Page to @yovo_app |
| `FB_PAGE_ID` | Facebook Page settings |
| `DRY_RUN` | `true` for first 3 days (preview only), then `false` |

### Routine prompt

> Run the daily Yovo post per CLAUDE.md instructions. Today's date: {{today}}.

---

## Adding a second app (`@reco4u_app`)

The repo is parameterized by `APP=<name>`. To add a second app:

1. Duplicate `data/brand.json` → `data/brand.reco4u.json`, edit colors/voice/manifesto
2. Duplicate `data/content-angles.json` → `data/content-angles.reco4u.json`
3. Update `src/lib/context.js` to load per-`APP` files
4. Create a second routine on `claude.ai/code/routines` with `APP=reco4u`, scheduled at 18:03 (stagger to avoid overlap)

---

## Brand fidelity

Why HTML + Puppeteer and not gpt-image-2 for the main rendering: HTML/CSS is deterministic and pixel-perfect on typography and color. gpt-image-2 still drifts on fonts and exact hex. We keep gpt-image-2 as an optional tool for decorative variants only.

The three themes (Yovo Green, Classy, Winter Ark) match the in-app theme system.
