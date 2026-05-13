# App Screenshots

This folder holds **real screenshots of the Yovo iOS app**, captured from a device or simulator.

## Rules

1. **Screenshots are IMMUTABLE.**
   Never modify, recolor, recompose, or overlay anything *inside* a screenshot. The app UI you see must be the app UI Quentin shipped. They are evidence, not design canvas.

2. **Framing is OK, redrawing is not.**
   You can place a screenshot inside a generated background, add a Yovo-branded caption next to it, or composite it onto a device mockup. You cannot replace any pixel of the actual screenshot.

3. **If you ever prompt an image model with a screenshot**, explicitly say:
   > "This is a screenshot of the Yovo iOS app. Do NOT redraw the interface, do NOT replace UI elements with synthetic versions. Keep the screenshot pixel-exact. Only generate the surrounding background/frame."

## Naming convention

```
{section}-{state}-{theme}.png
```

Examples:
- `home-empty-yovo_green.png`
- `home-4-tasks-winter_ark.png`
- `archive-end-of-day-classy.png`
- `widget-home-screen.png`

## How they get used

Future template `screenshot.html` will composite a screenshot inside a branded frame for "feature showcase" posts. Not implemented yet — current templates are text-only (`hook.html`, `resolution.html`).
