# Security Audit Report — visual-explainer

**Date:** 2026-03-20
**Auditor:** Claude (Opus 4.6)
**Version Audited:** 0.6.3
**Overall Risk:** LOW

---

## Executive Summary

visual-explainer is a read-only agent skill that generates self-contained HTML visualizations. It has no runtime dependencies, no server-side code, no hardcoded secrets, and no dangerous file operations. The attack surface is minimal.

---

## Findings

### No Issues Found

| Area | Status | Notes |
|------|--------|-------|
| Code execution vectors | Clean | No `eval()`, `Function()`, or dynamic `innerHTML` from user input. Mermaid source uses `<script type="text/plain">` (inert). |
| File system access | Clean | All codebase access is read-only (git diff/log/show). Writes only to `~/.agent/diagrams/`. |
| Hardcoded secrets | Clean | Zero API keys, tokens, or credentials in the repository. |
| Network calls | Clean | No `curl`/`wget` to dynamic URLs. CDN references are static, trusted sources (jsDelivr, Google Fonts). |
| Shell scripts | Clean | Both `install-pi.sh` and `share.sh` use `set -e`, proper error handling, cleanup traps, and no injection vectors. |
| Input validation | Clean | Command arguments (branch names, file paths) validated by git/filesystem. No injection vectors identified. |
| XSS in generated HTML | Clean | All content is agent-generated static HTML. No user input directly rendered without agent mediation. |

### Observations (Informational — Not Vulnerabilities)

#### 1. Public Vercel Deployments
- **Risk:** LOW
- **Detail:** The `/share` command deploys HTML to Vercel with no authentication. Anyone with the URL can view the content.
- **Impact:** Diagrams showing architecture, code snippets, or internal details could leak sensitive information if shared carelessly.
- **Status:** By design and documented. No action needed, but users should be aware.

#### 2. Supply Chain — GitHub Clone in Installer
- **Risk:** LOW
- **Detail:** `install-pi.sh` runs `git clone https://github.com/nicobailon/visual-explainer.git` without pinning to a specific commit hash or tag.
- **Impact:** If the GitHub account were compromised, the installer would pull malicious code.
- **Recommendation:** Consider adding an optional `--ref` flag to pin to a specific tag/commit.

#### 3. CDN Dependencies — No Subresource Integrity (SRI)
- **Risk:** LOW
- **Detail:** Generated HTML loads Mermaid.js, Google Fonts, and Chart.js from CDNs without SRI hashes.
- **Impact:** A CDN compromise could inject malicious JavaScript into generated HTML pages.
- **Recommendation:** Add `integrity` and `crossorigin` attributes to CDN `<script>` and `<link>` tags in templates and reference docs. Example:
  ```html
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"
          integrity="sha384-..." crossorigin="anonymous"></script>
  ```

#### 4. Version Mismatch
- **Risk:** NONE (cosmetic)
- **Detail:** `plugins/visual-explainer/.claude-plugin/plugin.json` reports version `0.6.2`, while `package.json` reports `0.6.3`.
- **Recommendation:** Sync version numbers.

---

## Scope

### Files Reviewed

| Category | Files |
|----------|-------|
| Config | `package.json` (x2), `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `plugins/visual-explainer/.claude-plugin/plugin.json` |
| Skill Definition | `SKILL.md` |
| Commands | `commands/diff-review.md`, `commands/fact-check.md`, `commands/generate-slides.md`, `commands/generate-visual-plan.md`, `commands/generate-web-diagram.md`, `commands/plan-review.md`, `commands/project-recap.md`, `commands/share.md` |
| References | `references/css-patterns.md`, `references/libraries.md`, `references/responsive-nav.md`, `references/slide-patterns.md` |
| Templates | `templates/architecture.html`, `templates/data-table.html`, `templates/mermaid-flowchart.html`, `templates/slide-deck.html` |
| Scripts | `install-pi.sh`, `scripts/share.sh` |
| Docs | `README.md`, `CHANGELOG.md`, `LICENSE` |

### What Was Checked

- [x] Hardcoded secrets and credentials
- [x] Shell injection vectors in bash scripts
- [x] XSS vectors in generated HTML templates
- [x] Unsafe file operations (writes, deletes outside output dir)
- [x] Network calls to arbitrary/untrusted URLs
- [x] Dynamic code execution (`eval`, `Function`, `innerHTML`)
- [x] Input validation on command arguments
- [x] Dependency supply chain (npm, CDN)
- [x] Data exposure in shared deployments
- [x] Permission escalation paths

---

## Conclusion

**Recommendation: Safe for use in agent workflows.**

The skill operates entirely within the user's local filesystem and generates static HTML. The only remote interaction is optional Vercel deployment, which is explicitly designed to be public. The codebase demonstrates security-conscious design with clean separation of concerns.
