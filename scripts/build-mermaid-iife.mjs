#!/usr/bin/env node
// Dev-time only: bundle the pinned, vendored mermaid + @mermaid-js/layout-elk ESM
// builds into ONE classic (non-module) IIFE script that works from file:// in Chrome.
// Output: plugins/visual-explainer/assets/vendor/cookie/mermaid-elk.iife.min.js
// Exposes globalThis.mermaid (ELK layout already registered) and globalThis.mermaidLayoutElk.
// Requires esbuild (devDependency). No network access at build time or runtime.
import { build } from "esbuild";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendor = join(root, "plugins/visual-explainer/assets/vendor");
const outFile = join(vendor, "cookie/mermaid-elk.iife.min.js");
const entry = join(vendor, "cookie/.entry.mjs");

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(entry, [
  `import mermaid from ${JSON.stringify(join(vendor, "mermaid/dist/mermaid.esm.min.mjs"))};`,
  `import elkLayouts from ${JSON.stringify(join(vendor, "mermaid-layout-elk/dist/mermaid-layout-elk.esm.min.mjs"))};`,
  "mermaid.registerLayoutLoaders(elkLayouts);",
  "globalThis.mermaid = mermaid;",
  "globalThis.mermaidLayoutElk = elkLayouts;",
  "",
].join("\n"));
try {
  await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: "iife",
    legalComments: "none",
    banner: { js: "/* Cookie offline bundle: mermaid@11.17.2 + @mermaid-js/layout-elk@1.0.0 (MIT). Built by scripts/build-mermaid-iife.mjs from assets/vendor ESM. */" },
    outfile: outFile,
    logLevel: "info",
  });
} finally {
  rmSync(entry, { force: true });
}
