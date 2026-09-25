Use the canonical `visual-explainer` skill from `plugins/visual-explainer/`.

For OpenCode/opencode, the observed native skill path is `~/.config/opencode/skill/visual-explainer`. Optional command templates may be copied to `~/.config/opencode/command/` if your build supports them.

Activate by asking OpenCode to use the `visual-explainer` skill for diagrams, architecture overviews, visual reviews, slide decks, and complex tables. Generated pages go to `~/.agent/diagrams/`; browser auto-open behavior depends on the harness and sandbox.

Command-template behavior is build-dependent. The canonical skill docs and command markdown remain under `plugins/visual-explainer/`.

**Cookie offline:** pages must be self-contained and open from `file://`. Render tools inline assets automatically; if you write the HTML file yourself, finish with `node plugins/visual-explainer/offline/inline-assets.mjs <file.html>` (see `COOKIE.md`).
