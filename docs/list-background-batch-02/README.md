# YUNELA micro-task08 — LIST background batch02

Date: 2026-10-27 (Europe/Kyiv). Branch: fix/list-background-batch-02.
Base/staging: cbab997b42bab081f4c6c7f55972c00a21a1ef8d.

Precondition confirmed: Render current live dep-dbfotl4ipgvc73ap7d5g contains cbab997 and first check of all15 LIST-001..005 public files matched SHA-256. Latest live deploy rechecked after workspace cleanup: unchanged.

## Method and quality
Unmodified recolour() from approved scripts/background-pilot-six.py. Immutable base source. Spatial background correction #FAF9F5 preserves continuous shadow residuals; contrasted and dark subject pixels unchanged before encoding. No generation, global grade, composition, leaf repositioning or master resizing. Light subject edges may receive subtle correction; output is lossy, not every pixel is identical.

Compared fresh q92 and q95 /WebP method6 from corrected lossless pixels. Chose q92 for all5 after source/lossless/q92/q95 detail review. No conspicuous halos, morphology damage, subject colour shift or contact-shadow artifacts. Same1200 masters and existing480/800 adaptive dimensions. Corner samples within2levels of250/249/245, typically251/249/245.

| SKU | Before bytes | q92 selected | q95 |
|---|---:|---:|---:|
| LIST-007 | 463226 | 411786 | 502704 |
| LIST-008 | 552798 | 500476 | 594244 |
| LIST-009 | 412652 | 372932 | 442878 |
| LIST-010 | 507582 | 458436 | 556634 |
| LIST-011 | 566428 | 512270 | 610182 |
| Total | 2502686 | 2255900 | 2706642 |

Savings vs originals: 9.86%. Minimum foreground luminance SSIM vs corrected lossless: 0.994077.

## Validation and persistence
260 tests /38 files PASS; TypeScript, ESLint, image validator56primary/347files and full frontend/server production build PASS. All15 exports decode, dimensions/hashes checked. Only selected15 WebP and corresponding SHA-256 fields changed. All other51SKU, including prior pilot and batch01, every secondary/texture, non-hash manifest data, sourceSku/order, CSS, catalog, YUNA, business logic unchanged.

Earlier local batch02 commit ba0bf22 and scratch were removed by automatic workspace maintenance before a branch was created. Files had been uploaded as unreferenced GitHub blobs. Reproduced with the same approved method/encoding; total and every SKU total match previous report. Old per-file hashes unavailable: do not claim byte identity to that local commit. Rebuilt environment and reran all validation. Native SQLite build required manually extracted official Node headers because tar ownership operations are unsupported in this runtime; no repository dependency changes.

## Evidence and changed files
BEFORE_AFTER.jpg: five full pairs plus same-coordinate leaf/contact-shadow crops. LIST-007-details.jpg through LIST-011-details.jpg: source/lossless/q92/q95 at native coordinates. PROCESSING.json: all source/output hashes, dimensions, candidate metrics and sizes. QA_RESULTS.json: test and scope proof.

Changed:15 public/creative/LIST-007..011 primary/480/800 WebP; content/creative-images.v1.json; content/creative-gallery.v1.json; scripts/process-list-batch-02.py; docs/DEVELOPER_HANDOFF_LATEST.md; docs/list-background-batch-02 reports and comparisons. No runtime/package/lock changes.

No merge/deploy. Staging remains cbab997; branch for this batch is independent. Browser acceptance of new batch is not claimed before staging authorization. Remote commit tree verified against local tree and branch availability checked before delivery. STOP for CEO visual review before publication or more SKU.
