# Cookie offline policy — visual-explainer

Fleet fork of nicobailon/visual-explainer for Chronillogical-Potato / Cookie Monster.

## Runtime policy (hard)

- **Zero** Google Fonts / jsDelivr / CDN at view-time.
- Never `curl … | bash` install-pi (or any remote install pipe). Register MCP/skill from a local checkout only.
- Output HTML must load scripts and fonts from paths under this repo (or the synced `cookie-viz-assets` tree).

## Local assets

| Path | Role |
|------|------|
| `plugins/visual-explainer/assets/fonts/` | Cookie fonts (copied from fleet `cookie-viz-assets/fonts/`) |
| `plugins/visual-explainer/assets/vendor/mermaid/` | mermaid@11.17.2 ESM min + chunks |
| `plugins/visual-explainer/assets/vendor/mermaid-layout-elk/` | `@mermaid-js/layout-elk@1.0.0` ESM min + chunks |
| `plugins/visual-explainer/assets/MANIFEST.json` | Font policy + sha256 (also at `/workspace/cookie-viz-assets/MANIFEST.json`) |
| `plugins/visual-explainer/assets/vendor/VERSIONS.txt` | Pinned mermaid / ELK versions |

### Fonts (only these three)

| File | CSS family | Use |
|------|------------|-----|
| `FiraCodeNerdFontPropo-Retina.ttf` | `Fira Code Nerd Font Propo` | GUI / body / reading |
| `FiraCodeNerdFontMono-Retina.ttf` | `Fira Code Nerd Font Mono` | Grid / mono / code only |
| `GeistPixel-Line.otf` | `Geist Pixel Line` | Titles / headers / standalone labels **only** |

**Geist Pixel Line rules:** never mix inline with other families; put it in its own structural HTML container (e.g. `<header class="cookie-title-block">`). Body/UI → Propo. Code/grid → Mono.

## Templates

Templates under `plugins/visual-explainer/templates/` use relative imports:

- `../assets/vendor/mermaid/dist/mermaid.esm.min.mjs`
- `../assets/vendor/mermaid-layout-elk/dist/mermaid-layout-elk.esm.min.mjs`
- `../assets/fonts/…` via `@font-face`

Prefer `quick/render.mjs` JSON→HTML when it already avoids CDN.

## Agent / MCP

- Local command only; jail `VISUAL_EXPLAINER_OUTPUT_DIR` to a known directory.
- Explicit agent/Shem activation only — no cloud provider defaults.
