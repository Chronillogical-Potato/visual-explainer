Use the canonical `visual-explainer` skill from `plugins/visual-explainer/`.

OpenClaw support is lightweight rules guidance, not a native plugin adapter. Point the agent at `plugins/visual-explainer/SKILL.md` and ask it to follow that workflow when producing diagrams, visual reviews, slide decks, or complex tables.

Generated pages should be written to `~/.agent/diagrams/` and opened in a browser when the environment allows it. If OpenClaw does not support command templates, read the matching file under `plugins/visual-explainer/commands/` and execute its instructions manually.

**Cookie offline:** pages must be self-contained and open from `file://`. Render tools inline assets automatically; if you write the HTML file yourself, finish with `node plugins/visual-explainer/offline/inline-assets.mjs <file.html>` (see `COOKIE.md`).
