import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inlineCookieAssets, inlineCookieAssetsInFile } from "./inline-assets.mjs";
import { renderQuickSpec } from "../quick/render.mjs";

const skillDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const templatesDir = join(skillDir, "templates");
const templates = readdirSync(templatesDir).filter((f) => f.endsWith(".html"));

function assertSelfContained(html, label) {
  assert.doesNotMatch(html, /url\(\s*['"]?\.\.?\/assets\//, `${label}: relative font url left`);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=/i, `${label}: <script src> left`);
  assert.doesNotMatch(html, /\bimport\s+\w+\s+from\s+['"][^'"]*\.mjs['"]/, `${label}: ESM import left`);
  assert.doesNotMatch(html, /fonts\.googleapis|cdn\.jsdelivr|unpkg\.com/, `${label}: CDN left`);
}

test("stock templates never import ES modules or CDNs (Chrome blocks module loads on file://)", () => {
  for (const file of templates) {
    const html = readFileSync(join(templatesDir, file), "utf8");
    assert.doesNotMatch(html, /\bimport\s+\w+\s+from\s+['"][^'"]+['"]/, file);
    assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i, file);
  }
});

test("every stock template inlines to a self-contained page without warnings", () => {
  for (const file of templates) {
    const { html, warnings, inlined } = inlineCookieAssets(readFileSync(join(templatesDir, file), "utf8"));
    assert.deepEqual(warnings, [], file);
    assert.equal(inlined.fonts, 3, `${file}: 3 Cookie fonts embedded`);
    assert.match(html, /url\('data:font\/woff2;base64,/, file);
    assertSelfContained(html, file);
    if (/mermaid/i.test(file) || /slide-deck/.test(file)) assert.equal(inlined.mermaid, true, `${file}: mermaid bundle embedded`);
  }
});

test("Mermaid bundle is injected before the module script that uses it and exactly once", () => {
  const src = readFileSync(join(templatesDir, "mermaid-flowchart.html"), "utf8");
  const once = inlineCookieAssets(src).html;
  const twice = inlineCookieAssets(once);
  assert.equal(twice.html, once, "idempotent");
  assert.equal(once.split('data-cookie-inline="mermaid-elk"').length - 1, 1);
  assert.ok(once.indexOf('data-cookie-inline="mermaid-elk"') < once.indexOf("const mermaid = globalThis.mermaid"));
  assert.doesNotMatch(once.slice(once.indexOf('data-cookie-inline="mermaid-elk"'), once.indexOf("const mermaid = globalThis.mermaid")), /<\/script>[\s\S]*<\/script>[\s\S]*<\/script>/);
});

test("legacy ESM and CDN mermaid imports are rewritten to the vendored globals", () => {
  const legacy = `<!doctype html><html><head>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet">
</head><body><pre class="mermaid">graph TD; A-->B</pre>
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  import elkLayouts from '../assets/vendor/mermaid-layout-elk/dist/mermaid-layout-elk.esm.min.mjs';
  mermaid.registerLayoutLoaders(elkLayouts);
  mermaid.initialize({ startOnLoad: true });
</script></body></html>`;
  const { html, warnings, inlined } = inlineCookieAssets(legacy);
  assert.equal(inlined.mermaid, true);
  assert.match(html, /const mermaid = globalThis\.mermaid;/);
  assert.match(html, /const elkLayouts = globalThis\.mermaidLayoutElk;/);
  assertSelfContained(html, "legacy");
  assert.ok(warnings.some((w) => /Google Fonts/.test(w)));
  assert.ok(!warnings.some((w) => /external reference/.test(w)), warnings.join("\n"));
});

test("inlined script content cannot close its own <script> element", () => {
  const { html } = inlineCookieAssets(readFileSync(join(templatesDir, "slide-deck.html"), "utf8"));
  const start = html.indexOf('data-cookie-inline="mermaid-elk"');
  const end = html.indexOf("</script>", start);
  assert.ok(end - start > 1_000_000, "bundle body is intact (not cut short by an inner </script>)");
});

test("external references are reported, not silently kept", () => {
  const { warnings } = inlineCookieAssets('<html><body><script src="https://example.com/x.js"></script><img src="https://example.com/a.png"></body></html>');
  assert.ok(warnings.some((w) => w.includes("https://example.com/x.js")));
  assert.ok(warnings.some((w) => w.includes("https://example.com/a.png")));
});

test("quick/render.mjs output embeds fonts and uses a Geist title container", async () => {
  const html = await renderQuickSpec({ title: "Quick", sections: [{ title: "S", cards: [{ title: "c", body: "b" }] }] });
  assertSelfContained(html, "quick");
  assert.match(html, /data:font\/woff2;base64,/);
  assert.match(html, /<div class="cookie-title-block"><h1>Quick<\/h1><\/div>/);
});

test("CLI helper rewrites a file in place", () => {
  const dir = mkdtempSync(join(tmpdir(), "ve-inline-"));
  const path = join(dir, "page.html");
  writeFileSync(path, readFileSync(join(templatesDir, "architecture.html"), "utf8"));
  const result = inlineCookieAssetsInFile(path);
  assert.deepEqual(result.warnings, []);
  assertSelfContained(readFileSync(path, "utf8"), "cli");
});
