# YUNELA Micro-task11 — LIST batch03 staging acceptance

Date:2026-10-27 Europe/Kyiv
URL:https://yunela-v92-demo.onrender.com
Published SHA:f6ddcb149b7cc9b0b57f1d5a107b52f028f25020
Render deploy:dep-dbgghk0m7kps73dbjtcg LIVE finished2026-10-27T20:26:25.157126Z.
Existing static service:srv-dbej0rjncjis73edf2h0. No new service or paid resources.

## Integration and validation

Verified current staging branch feat/creative-gallery-v9-2 and LIVE SHA0e04f802.
Verified approved GitHub commit f6ddcb1 and clean detached worktree at that SHA.
Diff proof:only9WebP primary/master480/800 for LIST-012/013/015 and corresponding
SHA fields plus approved offline batch03 script/docs. All other53SKU records,
non-hash manifest data, all secondary/texture, sourceSku, gallery order, CSS,
UI/design/catalog/YUNA/business logic remain identical to baseline. LIST-014/016
all asset bytes and manifest records unchanged, matching previously approved pilot.

Tests ran before integration/deploy:260tests/38files PASS, TypeScript via tsc -b,
ESLint, image validation56primary/347files and full production frontend/server
build PASS. VITE_STATIC_DEMO=1 npx vite build PASS. Dedicated QA harness lint PASS.

Fast-forwarded existing staging ref to exact approved f6ddcb1 using expected-SHA
lease; no conflicts, merge commit or main/PR-base changes. The approved remote
commit itself is the integration/deployment commit. Auto-deploy remains off;
explicit existing-service deployment confirmed f6ddcb1. No commerce enablement.

GitHub CI SUCCESS:https://github.com/sjastellar-eng/Yunela-site/actions/runs/40577962354

## Public browser and asset acceptance

Chromium156.0.8078.47,DPR1,390x844 touch/mobile emulation and1440x1000 desktop.
At each width:catalog56;19SKU comprising all previously approved16 plus3new;
46gallery frames decoded and correct order; primary restored; return retains
search; no horizontal overflow. No page/console errors, failed requests,
HTTP errors or /api/commerce calls. No purchase add-to-cart button; demo notice
states real orders and payment unavailable.

LIST-012..016 primary backgrounds visually consistent with #FAF9F5 containers.
Reviewed full catalog/detail screenshots: no conspicuous new halo, inner image
boundary, product cropping/stretching or shadow damage. Existing LIST cover and
PHOTO contain behavior preserved. LIST-014/016 were NOT reprocessed. Other gallery
frames remain approved source assets, without additional background processing.

New3 masters/480/800 WebP retain q92/method6 approved bytes. Independent public
HTTPS checks:all57 primary/adaptive files across19SKU match expected SHA-256,
including LIST-014/016 and all previous16. All other assets unchanged by Git diff.
Static-demo public JS/CSS exactly match local built bytes; noindex preserved.
Independent HTTPS uses normal TLS certificate verification. Browser context
ignores intercepted TLS errors only if HTTPS_PROXY exists in QA environment.

## Evidence and findings

Four390/1440-catalog/detail-contact.jpg show all5target SKU on public staging.
Raw20 viewport screenshots retained locally. BROWSER_RESULTS.json contains all
currentSrc/fit/background and checks. HTTPS_RESULTS.json stores57hash/status/size
records; SUMMARY.json summarizes outcomes. check-browser.mjs is a QA-only harness
(run from root with CHROME_PATH); no runtime dependencies or app source changes.

No new defects found. Known unchanged issue:isolated filtered desktop650px card
requests480px due existing33vw sizes hint; may soften fine detail. Outside this
scope, not changed. Mobile validation uses emulation, not a physical device.

QA-only evidence commit stays on qa/list-batch-03-staging-11, never deployed.
Staging remains exact approved f6ddcb1. No main merge, paid resources, real orders
or payment activation. STOP after micro-task11; await CEO instruction.
