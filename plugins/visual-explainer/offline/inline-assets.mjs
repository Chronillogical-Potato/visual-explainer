#!/usr/bin/env node
// Cookie offline inliner: turns a visual-explainer HTML page into ONE self-contained
// file that opens by double-click from file:// in Chrome, on any machine, with zero
// outside requests.
//
// - @font-face url(...assets/fonts/<file>)  -> data: URL (WOFF2 when available)
// - <script src="...assets/vendor/...js">   -> inline classic <script>
// - ESM `import mermaid from '...mermaid...mjs'` / layout-elk imports (vendored OR CDN)
//   -> globals from the vendored classic IIFE bundle (Chrome blocks module loads on file://)
// - <script src="https://.../mermaid(.min).js"> -> vendored IIFE bundle
// - Google Fonts <link>/@import -> removed
// Idempotent: running it twice yields the same file. Pure local file reads; no network.
import { existsSync, readFileSync, writeFileSync, realpathSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const defaultAssetsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
const MERMAID_BUNDLE = "vendor/cookie/mermaid-elk.iife.min.js";
const BUNDLE_MARKER = 'data-cookie-inline="mermaid-elk"';

const fontMime = { ".woff2": ["font/woff2", "woff2"], ".woff": ["font/woff", "woff"], ".ttf": ["font/ttf", "truetype"], ".otf": ["font/otf", "opentype"] };

function escapeInlineScript(js) {
  return js.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
}

function fontDataUrl(assetsDir, file, cache) {
  if (cache.has(file)) return cache.get(file);
  const fontsDir = join(assetsDir, "fonts");
  const stem = file.replace(/\.(ttf|otf|woff2?)$/i, "");
  const candidates = [`${stem}.woff2`, file];
  let result = null;
  for (const name of candidates) {
    const path = join(fontsDir, name);
    const ext = extname(name).toLowerCase();
    if (fontMime[ext] && existsSync(path)) {
      const [mime, format] = fontMime[ext];
      result = { url: `data:${mime};base64,${readFileSync(path).toString("base64")}`, format };
      break;
    }
  }
  cache.set(file, result);
  return result;
}

function mermaidBundleTag(assetsDir) {
  const js = readFileSync(join(assetsDir, MERMAID_BUNDLE), "utf8");
  return `<script ${BUNDLE_MARKER}>\n${escapeInlineScript(js)}\n</script>`;
}

const isMermaidSpecifier = (spec) => /mermaid/i.test(spec) && !/layout-elk/i.test(spec) && /(\.m?js$|^https?:|^mermaid$)/i.test(spec);
const isElkSpecifier = (spec) => /layout-elk/i.test(spec);

/**
 * @param {string} html
 * @param {{ assetsDir?: string }} [options]
 * @returns {{ html: string, warnings: string[], inlined: { fonts: number, scripts: number, mermaid: boolean } }}
 */
export function inlineCookieAssets(html, options = {}) {
  const assetsDir = options.assetsDir ?? defaultAssetsDir;
  const warnings = [];
  const inlined = { fonts: 0, scripts: 0, mermaid: html.includes(BUNDLE_MARKER) };
  const fontCache = new Map();
  let needsMermaid = false;
  let out = html;

  // 1. Remove Google Fonts (forbidden by Cookie policy).
  out = out.replace(/<link\b[^>]*\bhref=["']https?:\/\/fonts\.(?:googleapis|gstatic)\.com[^"']*["'][^>]*>\s*/gi, () => {
    warnings.push("removed Google Fonts <link>");
    return "";
  });
  out = out.replace(/@import\s+url\(\s*["']?https?:\/\/fonts\.googleapis\.com[^)]*\)\s*;?/gi, () => {
    warnings.push("removed Google Fonts @import");
    return "";
  });

  // 2. Fonts referenced from any .../assets/fonts/<file> (relative, absolute or file://).
  out = out.replace(
    /url\(\s*(['"]?)([^'")]*?assets\/fonts\/([A-Za-z0-9._-]+\.(?:ttf|otf|woff2?)))\1\s*\)(\s*format\(\s*(['"])[^'"]*\5\s*\))?/gi,
    (match, _q, _full, file) => {
      const data = fontDataUrl(assetsDir, file, fontCache);
      if (!data) {
        warnings.push(`font not found in ${join(assetsDir, "fonts")}: ${file}`);
        return match;
      }
      inlined.fonts += 1;
      return `url('${data.url}') format('${data.format}')`;
    },
  );

  // 3. Classic <script src> pointing at the vendored tree or at a CDN mermaid build.
  out = out.replace(/<script\b([^>]*?)\bsrc=(["'])([^"']+)\2([^>]*)>\s*<\/script>/gi, (match, pre, _q, src, post) => {
    const attrs = `${pre} ${post}`;
    if (/type=["']module["']/i.test(attrs)) {
      if (isMermaidSpecifier(src) || isElkSpecifier(src)) { needsMermaid = true; return ""; }
      return match;
    }
    if (/(^|\/)assets\/vendor\/cookie\/mermaid-elk\.iife\.min\.js$/.test(src) || (/^https?:/i.test(src) && /mermaid(\.min)?\.js$/i.test(src))) {
      needsMermaid = true;
      return "";
    }
    const vendorMatch = src.match(/(?:^|\/)assets\/(vendor\/[A-Za-z0-9._\/-]+\.js)$/);
    if (vendorMatch) {
      const path = join(assetsDir, vendorMatch[1]);
      if (existsSync(path)) {
        inlined.scripts += 1;
        return `<script data-cookie-inline="${basename(path)}">\n${escapeInlineScript(readFileSync(path, "utf8"))}\n</script>`;
      }
      warnings.push(`vendored script not found: ${vendorMatch[1]}`);
    }
    return match;
  });

  // 4. ESM imports of mermaid / layout-elk inside inline module scripts -> globals.
  out = out.replace(/(<script\b[^>]*type=["']module["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (match, open, body, close) => {
    let changed = false;
    const newBody = body
      .replace(/import\s+(\w+)\s+from\s+(["'])([^"']+)\2\s*;?/g, (m, name, _q, spec) => {
        if (isElkSpecifier(spec)) { changed = true; return `const ${name} = globalThis.mermaidLayoutElk;`; }
        if (isMermaidSpecifier(spec)) { changed = true; return `const ${name} = globalThis.mermaid;`; }
        return m;
      })
      .replace(/import\s+\*\s+as\s+(\w+)\s+from\s+(["'])([^"']+)\2\s*;?/g, (m, name, _q, spec) => {
        if (isMermaidSpecifier(spec)) { changed = true; return `const ${name} = globalThis.mermaid;`; }
        return m;
      });
    if (!changed) return match;
    needsMermaid = true;
    return `${open}${newBody}${close}`;
  });

  // 5. Inject the vendored IIFE once, before the first script that uses it.
  if (needsMermaid && !out.includes(BUNDLE_MARKER)) {
    const tag = mermaidBundleTag(assetsDir);
    const firstUse = out.search(/<script\b[^>]*type=["']module["'][^>]*>[\s\S]*?globalThis\.mermaid|<script\b(?![^>]*data-cookie-inline)[^>]*>(?:(?!<\/script>)[\s\S])*?\bmermaid\./i);
    const bodyEnd = out.search(/<\/body>/i);
    const at = firstUse >= 0 ? firstUse : bodyEnd >= 0 ? bodyEnd : out.length;
    out = `${out.slice(0, at)}${tag}\n${out.slice(at)}`;
    inlined.mermaid = true;
  }

  // 6. Report anything that would still reach outside (links in <a href> are fine).
  const external = new Set();
  const scan = out.replace(/<script data-cookie-inline[^>]*>[\s\S]*?<\/script>/g, "").replace(/data:[a-z0-9.+\/-]+;base64,[A-Za-z0-9+\/=]+/gi, "data:");
  for (const m of scan.matchAll(/<(script|link|img|iframe|source|video|audio)\b[^>]*\b(?:src|href)=["'](https?:\/\/[^"']+)["']/gi)) external.add(m[2]);
  for (const m of scan.matchAll(/url\(\s*["']?(https?:\/\/[^"')]+)/gi)) external.add(m[1]);
  for (const m of scan.matchAll(/\bfrom\s+["'](https?:\/\/[^"']+)["']|\bimport\(\s*["'](https?:\/\/[^"']+)["']/g)) external.add(m[1] ?? m[2]);
  for (const m of scan.matchAll(/<script\b[^>]*\bsrc=["'](?!data:)([^"']+)["']/gi)) if (!/^https?:/i.test(m[1])) warnings.push(`relative script left un-inlined (breaks when the file moves): ${m[1]}`);
  for (const m of scan.matchAll(/url\(\s*["']?((?:\.\.?\/|\/)[^"')]+\.(?:ttf|otf|woff2?|css))/gi)) warnings.push(`relative asset left un-inlined: ${m[1]}`);
  for (const url of external) warnings.push(`external reference (blocked by Cookie policy): ${url}`);

  return { html: out, warnings, inlined };
}

export function inlineCookieAssetsInFile(inputPath, outputPath = inputPath, options = {}) {
  const html = readFileSync(inputPath, "utf8");
  const result = inlineCookieAssets(html, options);
  writeFileSync(outputPath, result.html, "utf8");
  return { ...result, path: resolve(outputPath) };
}

function isMain() {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("-h") || args.includes("--help")) {
    process.stdout.write("Usage: inline-assets.mjs <input.html> [output.html]\nEmbeds Cookie fonts + vendored mermaid/ELK so the page works from file:// anywhere. Rewrites in place when output is omitted.\n");
    process.exit(args.length ? 0 : 1);
  }
  const [input, output] = args;
  const result = inlineCookieAssetsInFile(input, output ?? input);
  process.stdout.write(`${result.path} (fonts inlined: ${result.inlined.fonts}, scripts inlined: ${result.inlined.scripts}, mermaid bundle: ${result.inlined.mermaid ? "yes" : "no"})\n`);
  for (const warning of result.warnings) process.stderr.write(`warning: ${warning}\n`);
}
