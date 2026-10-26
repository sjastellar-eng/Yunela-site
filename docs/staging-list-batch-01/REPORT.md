# Micro-task 07B — recovered LIST batch staging acceptance

Date: 2026-10-26 (Europe/Kyiv).
Live URL: https://yunela-v92-demo.onrender.com
Published SHA: cbab997b42bab081f4c6c7f55972c00a21a1ef8d.
Render deploy: dep-dbfotl4ipgvc73ap7d5g, LIVE, finished 2026-10-26 19:33:41 Kyiv.
Existing static site srv-dbej0rjncjis73edf2h0. No resources or plan changes.

## Integration and checks

Verified approved commit exists in GitHub. Render follows feat/creative-gallery-v9-2.
Verified prior remote HEAD 87955d66b4966cff242e9123ade376a98f58d186.
Fast-forwarded that ref with expected-SHA lease to approved cbab997; no merge.
main and PR base untouched. Auto-deploy remains disabled; explicit API deploy.
Clean detached worktree at cbab997 used for validation/build. An untracked
PHOTO-017 temporary file in the earlier worktree was preserved and excluded.
Broad unpublished 741deae is not an ancestor and was not included.

Diff against baseline: exactly 15 selected primary WebP; two manifests changing
only selected primary/responsive hashes; approved offline recovery script/docs.
Non-hash manifest data, all other 51 SKU including earlier six, every secondary
and texture, CSS, source code, catalog facts, YUNA and commerce unchanged.

260 tests / 38 files PASS. TypeScript/full frontend/server production build PASS.
ESLint PASS. Image validator PASS (56 primary /347 exports). Static-demo build
VITE_STATIC_DEMO=1 npx vite build PASS, matching Render demo configuration.
GitHub CI SUCCESS: https://github.com/sjastellar-eng/Yunela-site/actions/runs/40369664325

Independent HTTPS verification PASS: all347 public master/adaptive/gallery assets
match approved SHA-256 values. Local static-demo JS/CSS bytes match public files.
Noindex preserved. Normal TLS certificate verification used. HTTPS_RESULTS.json
contains all response statuses, sizes and hashes.

## Public browser acceptance

Chromium 156.0.8078.47, DPR1, desktop1440x1000 and mobile390x844 touch emulation.
Each viewport: catalog56, search each of 5 new +6 pilot, correct primary,
all gallery frames, restore primary, return with retained search, no overflow.
No page errors, console errors, failed requests, HTTP errors or /api/ requests.
No add-to-cart purchase button. Static-demo notice states orders/payment unavailable.

New primary backgrounds match existing #FAF9F5 containers visually. No conspicuous
new halos, product clipping/stretching or contact-shadow artifacts in reviewed
screenshots. LIST cover and PHOTO contain behavior retained. Secondary/texture
backgrounds remain existing approved assets; this task does not recolour them.
Desktop card requests480 / detail800; mobile card/detail480; version hashes correct.
Every gallery frame decodes. BROWSER_RESULTS.json contains currentSrc and metrics.

Screenshots: 1440/390-catalog-contact.jpg and 1440/390-detail-contact.jpg each show
all five SKU, captured from public staging. Raw viewport PNGs retained locally.

## Findings and limits

No new blocking defects. Known preexisting sizes hint: isolated desktop filtered
card renders650px but requests480px (33vw hint). Can soften fine detail in this
wide-card case; unchanged by this batch. Fix needs separate scope/approval.
Mobile checks are viewport/touch emulation, not physical Android-device testing.
Browser context ignores intercepted TLS errors only when HTTPS_PROXY is present;
independent HTTPS verification uses normal certificate validation.

Initial QA assertion incorrectly expected thumbnails for a single-image pilot
gallery PHOTO-008. Corrected harness expectation; full rerun PASS, no app edits.

Staging SHA remains approved cbab997. QA evidence checkpoint is separate and is
not deployed. No main merge, checkout/payment enabling or paid resources.
STOP after this five-SKU publication; await next CEO instruction.
