# YUNELA Developer V9 — experience and YUNA

## Baseline and scope
Verified Draft PR #24: open, unmerged, head 6eed901dfee1473cfea7863d602c97c84558d0e2. V9 branches from that commit. PR #24, main, yunela-demo and yunela-catalog-v2-demo are not changed.

Visual Correction V2 code, local fonts and hero asset are reused. Written CEO direction supplies the brand requirements. Standalone Brand Strategy/Identity files were not found in the accessible filename/content searches; no new brand rules were invented. The V7 Sommelier Audit and V2 CSV/JSON sources were read. Original YUNELA_PRODUCT_IMPORT_V1.csv was downloaded and all 56 identities matched. V2 spreadsheet/content hashes remain in docs/v8.

Creative V6.2/V6.3 QA was read. All 26 are unapproved illustrative derivatives; LIST-025/026 are explicitly rejected. No corrected V6.4 package was found. These files are not published. Thirty existing supplier source images are retained with source/identity caveats. Twenty-six LIST placeholders remain. The accepted sourceSku/checksum/rights/assignment image importer remains unchanged; final replacement requires per-SKU approvals and actual files, not renaming another tea image.

## User experience
Black/graphite V2 hero, uppercase Ukrainian headline, brand introduction, YUNA entry, editorial discovery collections, featured record introductions, category explanations and 56-card catalog. Search includes stable identifiers and original names. Default ordering preserves V2 photographed cards first; optional sorting uses name, sourceSku or declared category, never invented prices/popularity. Informational details retain disclosure and evidence. A session-only personal selection prepares future choice without creating an order. No checkout/payments are activated.

## YUNA V1: RULE-BASED FALLBACK
This release is explicitly not generative AI. A local state machine recognizes limited Ukrainian/Russian preference phrases and offers four editable questions, previous/next navigation, current preference summary, references, alternatives, two-card comparison and links to real sourceSku details. Returning from details retains session answers. Optional localStorage save/delete uses schema/size validation and handles denied/corrupt storage. Text conversation stays in memory and is never sent remotely. No customer identity or authenticated account is claimed.

Editorial discovery uses V2 styleGuidance.tags and sourceIds, projected to src/data/style-discovery.v1.json without internal commercial data. It only admits real, non-fixture records with disclosed content and valid source references. Category and explicit reference tags narrow a browse pool; sourceSku establishes stable order. No scores, MATCH claims, lot tasting or guaranteed characteristics are produced. Experience changes explanation; intensity and bitterness cannot rank unmeasured lots and this is stated. There are zero verified personalized lot recommendations. Commercial flags stay false.

## Existing architecture and future AI
The existing Recommendation Engine and all regression tests remain unchanged. It expects measured sensory values and legacy inventory/publication eligibility. We do not set inventory=1, price=0 or sensory=50 to force the 56 draft records into it. The V8 sommelierReadiness gate remains authoritative for verified sensory eligibility. Engine/scoring activation awaits confirmed identities, lot profiles and CEO approval.

Customer Identity, Profile, Discovery Box and history exist in the older backend; the static preview does not call or expose them. The old unauthenticated profile APIs remain disconnected. No fake CRM lead capture or synchronization is introduced.

A server-only YunaIntentProvider port and POST /api/store/yuna/intent are prepared in the existing runtime. Default state is NOT_CONFIGURED (503 after session authentication). The endpoint has bearer session checks, existing origin checks, rate limiting, 8KiB body/600-character limits, eight-second deadline and sanitized errors. A provider can return only schema-valid preference enums; SKU, free text claims and tools are rejected. Catalog retrieval and visible explanations remain deterministic and evidence-bound. Credentials belong to server environment only. No provider is implemented or paid API enabled, and the static frontend never calls this endpoint. A concrete provider, authenticated backend deployment, budget and consent remain future decisions.

## Analytics and privacy
Existing AnalyticsTracker contracts are reused for start/complete/product view and editorial result view/click. Visibility uses IntersectionObserver with deduplication. Payloads carry attempt/version/sourceSku/mode only; no chat text, answers, PII or network collector. Diagnostic buffer is in memory, capped at 100 events. These are not aggregate conversion reports.

## Run and review
```sh
npm ci
npm run typecheck
npm run lint
npm test
VITE_STATIC_DEMO=1 npm run build
# Production static assets in dist; no backend needed for preview.
CHROME_PATH=/path/to/chrome node scripts/v9-browser-e2e.mjs
# Against an actually published preview:
DEMO_URL=https://PREVIEW.onrender.com CHROME_PATH=/path/to/chrome node scripts/v9-browser-e2e.mjs
```
Use a separate Render Static Site with branch feat/yuna-storefront-v9, autoDeploy=no, publishPath=dist, buildCommand='npm ci --ignore-scripts --include=dev && npx vite build', VITE_STATIC_DEMO=1, SKIP_INSTALL_DEPS=true, NODE_VERSION=24.19.0. No paid service or SQLite is needed. Existing noindex meta and robots.txt are retained. Noindex is not access control; preview contains public informational material only.

## Remaining limits
No generative model, verified sensory ranking, Creative V6.4 approved assets, saved account/tasting history, remote analytics or sales. Physical Android hardware is a CEO review step; automated checks emulate mobile viewports. Do not treat editorial choice as a supplier lot guarantee or commercial approval.

## CDN recovery
The first live check exposed a cached 404 for /demo-catalog.json (cf-cache-status HIT, age 119), while the exact same file with a fresh query returned HTTP 200 and 530425 bytes. Vite now computes a content digest from the catalog at build time; the frontend uses it as a query revision. Data changes update this digest automatically without source edits, and negative-cache entries for an old URL cannot hide the new catalog. Existing demo services are not touched.
