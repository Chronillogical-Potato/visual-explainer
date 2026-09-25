# Cookie offline policy — visual-explainer

Fleet fork of nicobailon/visual-explainer for Chronillogical-Potato / Cookie Monster.

## Runtime policy (hard)

- **Zero** Google Fonts / jsDelivr / CDN at view-time.
- Never `curl … | bash` install-pi (or any remote install pipe). Register MCP/skill from a local checkout only.
- Output HTML must be self-contained: fonts and scripts embedded (see below), so it opens by double-click from `file://` with zero outside requests.

## Local assets

| Path | Role |
|------|------|
| `plugins/visual-explainer/assets/fonts/` | Cookie fonts (copied from fleet `cookie-viz-assets/fonts/`) + WOFF2 copies used for embedding |
| `plugins/visual-explainer/assets/vendor/cookie/mermaid-elk.iife.min.js` | Classic (non-module) bundle of the two packages below — what pages load |
| `plugins/visual-explainer/offline/inline-assets.mjs` | Inliner: makes a page self-contained / file:// safe |
| `plugins/visual-explainer/assets/vendor/mermaid/` | mermaid@11.17.2 ESM min + chunks (build input only) |
| `plugins/visual-explainer/assets/vendor/mermaid-layout-elk/` | `@mermaid-js/layout-elk@1.0.0` ESM min + chunks (build input only) |
| `plugins/visual-explainer/assets/MANIFEST.json` | Font policy + sha256 (also at `/workspace/cookie-viz-assets/MANIFEST.json`) |
| `plugins/visual-explainer/assets/vendor/VERSIONS.txt` | Pinned mermaid / ELK versions |

### Fonts (only these three)

| File | CSS family | Use |
|------|------------|-----|
| `FiraCodeNerdFontPropo-Retina.ttf` | `Fira Code Nerd Font Propo` | GUI / body / reading |
| `FiraCodeNerdFontMono-Retina.ttf` | `Fira Code Nerd Font Mono` | Grid / mono / code only |
| `GeistPixel-Line.otf` | `Geist Pixel Line` | Titles / headers / standalone labels **only** |

**Geist Pixel Line rules:** never mix inline with other families; put it in its own structural HTML container (e.g. `<header class="cookie-title-block">`). Body/UI → Propo. Code/grid → Mono.

## Templates and delivery (file:// safe, self-contained)

Chrome blocks ES-module `import` from `file://` (origin `null`), so pages must **not** use
`<script type="module">import … from '…mjs'`. Instead:

- Templates load `../assets/vendor/cookie/mermaid-elk.iife.min.js` with a classic `<script src>`,
  then read `globalThis.mermaid` (ELK already registered; `globalThis.mermaidLayoutElk` also exposed).
- Fonts come from `../assets/fonts/…` via `@font-face` (templates open fine in place from the repo).
- **Delivered pages are self-contained.** `offline/inline-assets.mjs` embeds the fonts (WOFF2 data URLs)
  and the Mermaid+ELK bundle, rewrites stray mermaid/ELK ESM or CDN imports to the vendored globals,
  strips Google Fonts links, and warns about anything still external. The Pi `render` action, the MCP
  `visual_explainer_render_html` / `render_quick` tools and `quick/render.mjs` run it automatically,
  so files in `~/.agent/diagrams/` (or `VISUAL_EXPLAINER_OUTPUT_DIR`) work from any folder or machine.
- Manual: `node plugins/visual-explainer/offline/inline-assets.mjs page.html [out.html]` (or `npm run inline -- page.html`).
- A Mermaid page is ~9 MB (fonts ~3 MB + Mermaid/ELK ~6 MB); a non-Mermaid page ~3 MB.

Rebuild the classic bundle after bumping the vendored ESM (`assets/vendor/mermaid*/`, build input only):
`npm install && npm run build:vendor`. Tests: `npm test`.

## Agent / MCP

- Local command only; jail `VISUAL_EXPLAINER_OUTPUT_DIR` to a known directory.
- Explicit agent/Shem activation only — no cloud provider defaults.
