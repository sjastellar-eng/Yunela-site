# YUNELA Micro-task09 — LIST batch02 staging acceptance

Date:2026-10-27 (Europe/Kyiv).
URL:https://yunela-v92-demo.onrender.com
Published SHA:0e04f80246441745077e788a357328c7a1848085
Render deploy:dep-dbg8a6l9el5s73c6r5f0 LIVE, finished2026-10-27T11:04:24.592684Z.
Existing free static site:srv-dbej0rjncjis73edf2h0. No new services/plan changes.

## Integration

Confirmed previous current LIVE cbab997 and staging ref feat/creative-gallery-v9-2
at cbab997. Verified approved source branch/commit in GitHub. Clean detached
worktree at0e04f802 used. Diff against cbab997 permits only15 selected WebP,
their primary/480/800 SHA fields and approved batch02 offline script/docs.
All other51SKU records/images, every secondary/texture, all non-hash fields,
sourceSku/gallery order, CSS/design, catalog/YUNA and business logic unchanged.
Previous11 approved SKU preserved:LIST-001..006,014,016;PHOTO-001,008,010.
No broad unpublished741deae content included.

Fast-forward update of existing staging ref with expected-SHA lease to exact
approved0e04f802; no conflicts and no merge commit. Approved remote commit itself
is the integration/deployment commit, avoiding an unnecessary new app snapshot.
main and PR base untouched. Auto-deploy off; explicit existing-service deploy.

## Validation

260 tests /38 files PASS. TypeScript via tsc -b/full production frontend/server
build PASS. ESLint PASS; image validator56primary/347files PASS.
VITE_STATIC_DEMO=1 npx vite build PASS, matching existing Render configuration.
GitHub CI SUCCESS:https://github.com/sjastellar-eng/Yunela-site/actions/runs/40493279252
QA browser script also separately ESLint-checked after declaration of DOM/Node
globals; no production changes needed.

Public browser Chromium156.0.8078.47, DPR1:390x844 touch emulation and1440x1000.
At each viewport:catalog56;5new+11previous SKU;37 gallery frames decoded,
correct fixed primary restored, return retains search. No page/console errors,
failed requests, HTTP errors, horizontal overflow or /api/ commerce requests.
No purchase add-to-cart button; demo notice states orders/payments unavailable.

Five primary backgrounds visually consistent with #FAF9F5 containers. No
conspicuous boundary inside container, new halos, product cropping/stretching
or damaged contact shadows observed in reviewed catalog/detail screenshots.
Existing LIST cover/PHOTO contain retained. q92/method6 bytes unchanged from
approved commit. Primary masters and480/800 variants unchanged in size/paths.
Mobile catalog/detail requests480; desktop detail800, filtered catalog480.
Gallery secondary/texture images remain unchanged, not recoloured in this task.

Independent HTTPS PASS:all347 public master/gallery/responsive files exact SHA-256; static-demo JS/CSS match local bytes; noindex preserved; normal TLS certificate verification.

## Evidence and limits

BROWSER_RESULTS.json:currentSrc,computed fit/background,16SKU and error checks.
Four390/1440-catalog/detail-contact.jpg show all5newSKU from public staging.
Original20 viewport PNGs remain local; contact sheets persisted in GitHub.
check-browser.mjs is a QA-only reproducible harness; run from repository root
with CHROME_PATH set to a supported Chromium executable.

No new defects found. Known preexisting sizes hint remains:isolated filtered
650px desktop card requests480 (33vw hint), potentially softer detail. No fix
made under this scope. Mobile results are emulation, not physical-device tests.
Browser ignores intercepted TLS errors only when HTTPS_PROXY is present;
independent HTTPS verification validates certificates normally.

QA-only evidence checkpoint kept on qa/list-batch-02-staging-09, not deployed.
Application/staging stays0e04f802. No paid resources, main merge, checkout/payment
or real order enabling. STOP; do not process LIST-012..016.
