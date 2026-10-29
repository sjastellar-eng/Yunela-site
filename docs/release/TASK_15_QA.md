# Task 15 — order path and staging readiness

Date: 2026-10-29, Europe/Kyiv. Verdict: **NO COMMERCIAL GO**. Full order on the public staging: **BLOCKED**; isolated server path: **PASS**.

## Provenance and scope

- Existing service `srv-dbej0rjncjis73edf2h0`, My Workspace `tea-d3r4s556ubrc738e1j5g`: static_site, `feat/creative-gallery-v9-2`, autoDeploy off. URL: https://yunela-v92-demo.onrender.com/.
- Baseline Render LIVE deploy `dep-dbhjia61egvs73fo1e80`: `23f5c3d0b01c1830982542bf4bdf42619dfca027`. Verified through Render before changes. Task14B was not redeployed.
- Resumed saved checkpoint `df8445bc0b29067a7fd97afac0d942cc50c016ca`, parent exactly baseline. Fresh isolated checkout was clean. No local unrelated changes existed here; cancelled PHOTO work was not imported. Root/subdirectory AGENTS.md search found none. Read README, static-demo, V9.2 integration, runtime, tests and architecture/handoff documentation.
- Tested code is the commit that introduces this final report; its exact deploy SHA and post-live results are recorded in HANDOFF and deployment evidence after publication. Documentation-only follow-up commits need no redeploy.
- `evidence/source-scope.txt`: all catalog imports, public images and creative manifests unchanged from baseline. No redesign or image reprocessing.

## Source precedence

Read current Library contents, not snippets: CFO GO/NO GO V8(1) (`libfile_9e777073ca8081918a453b6cb1dd5b12`), CFO Recommendations V6(1) (`libfile_86be814c29f88191a6d5dfb1c8a27ea2`, includes Product V5 mapping and HOLD list), Operations SOP V3-1-1 (`libfile_a876e1c2d8b88191ab79134f5ce8a693`), Telegram Handoff Spec V1 (`libfile_76c1b4511f808191b4c3f688f92570eb`). Reviewed repository Product V2-derived import and contentV2/public catalog and Creative V8.4/V9.2 provenance.

Standalone Product V5 source was not resolved in this run: original-name/description parity to that complete external master remains PARTIAL, rather than claiming a fresh complete master comparison. CFO V6 mapping is secondary evidence, not replacement Product approval.

CEO V7 confirmed conditions supersede older open settlement/delivery conditions. The later supplied CEO V9 decision approves TWO payment models **FOR DESIGN**, and supersedes the older statement that COD is merely under consideration. It does not pick an advance or authorize live sales. Old V1/V2 fixtures are not new business approvals.

## Catalog, price and policy

56 stable sourceSku; validator checks 56 galleries / 347 master/adaptive files. Public catalog retains null prices, REQUEST availability, no confirmed stock or purchasable real SKU. No HOLD was lifted. PHOTO-008/011 identity, PHOTO-025/030 lot and PHOTO-004 economics remain separate restrictions. PHOTO-002/024 identity and missing LIST procurement bases also remain. Names/images remain assigned by exact sourceSku; no deduplication by similar name.

Working accepted whole 357g prices: PHOTO-010 1749 UAH; PHOTO-012 1679; PHOTO-026 1479. CFO V8 separately withholds publication/sales approval. Not publishing these as live prices is intentional. The development 20g minimum / 5g step and synthetic price curves are TEST fixtures; operational portion approval is still needed. Test examples: 20/25/50/100g = 170/200/350/600 UAH for TEST-WEIGHT. They are not YUNELA retail recommendations.

All image permissions and ILLUSTRATIVE/documentary=false restrictions remain. No present batch was certified. Existing CEO-reported permission in V9.2 is retained; it does not establish batch identity.

## Safe test boundary

HTTP tests use isolated in-memory or temporary SQLite, synthetic names/addresses/phones and TEST products. Store server is wired to TestMonoAdapter (no bank HTTP call); partner handoff is database simulation/export, dispatchEnabled=false. No supplier Telegram message, carrier shipment, actual payment or paid resource was created. Runtime refuses NODE_ENV=production; public static build cannot invoke order/account/operator mutations.

## Scenario matrix

| Scenario / expected result | Actual result / evidence | Status |
|---|---|---|
| Public staging catalog → real cart/checkout → operator | Site explicitly says orders/payment unavailable; static service has no API/SQLite. No order was created there. | BLOCKED |
| One TEST product, server quote, save, test payment, operator processing | Existing store-server and weight-store integration tests traverse actual HTTP/service/persistence path; test adapter only. | PASS locally |
| Two distinct TEST products, change weight, remove all / zero total | task15-order.test: 120000 → 95000 minor units, then zero; quote rejected on empty cart. | PASS locally |
| Invalid/missing recipient/phone/address | Server rejects malformed shipping/empty recipient/invalid phone with 400; existing browser-required fields retained. | PASS API; browser checkout BLOCKED |
| Repeat checkout/button-equivalent concurrent requests | Existing concurrent tests reserve/create once; same key returns same order; new Task15 retry also checks same id. Button remains disabled while busy. | PASS API; physical double-click UI BLOCKED |
| Refresh/reopen order and persistence | GET by owner returns saved snapshot; existing persistent SQLite restart test retains orders/cart/session. | PASS API; actual browser refresh checkout BLOCKED |
| Forced server failure, no partial order/reservation, retry | Task15 SQLite abort trigger returns 500, zero orders/reservations, cart preserved; successful retry creates one order. | PASS |
| Customer sees readable network/HTML/JSON 5xx failure | storeRequest tests cover disconnected fetch, HTML 502, JSON 500, malformed response and validation errors. | PASS unit; browser injection BLOCKED |
| Tampered price/total/CAC/weight | Server ignores client amount and calculates authoritative prices; 60000 minor accepted despite client amount=1; stale quotes and invalid weights rejected. | PASS |
| Foreign order/operator access | Foreign buyer 403; absent/buyer operator bearer 401; no x-customer-id spoof; staging gate/CSRF tests pass. | PASS locally |
| HOLD / unapproved real SKU cannot be purchased | 56-candidate import tests leave real products blocked; public build has no purchase controls. | PASS |
| Offline full payment success/decline/retry | Exact order total is requested; pending invoice reuse and cancelled/paid order guards pass. No real bank. Advance=not supported; offline full amount only. | PASS locally |
| Advance + COD totals/remaining amount | No implementation, selected advance or configured YUNELA COD recipient. 150/200/300 remain alternatives. No arithmetic simulation is passed off as implementation. | BLOCKED |
| Operator preparation/export / no external dispatch | Names/sourceSku/lot/mass/packages/cost basis/shipping present; corrected confirmed payer/settlement fields and added TEST Telegram draft; dispatchEnabled=false. | PASS locally |
| Full handoff spec / packed → supplier paid → dispatch | Carrier/declared value/date/operator contact still require input. No separate supplier-settlement proof gate exists in test workflow. Draft explicitly says NOT READY TO SEND. | BLOCKED for operational launch |
| Catalog/card/noindex/no JS errors at observed viewport | Fresh baseline screenshots LIST-022–026; current browser 1363×936, no horizontal overflow; final image loading checked separately. | PASS observed viewport |
| Exact 390px and 1440px UI acceptance | Cloud tab fixed at 1363px; managed preview route returns host-not-allowed, repair/restart did not resolve. Temporary harness/config changes removed. No crop or resized image is called a responsive test. | BLOCKED |

Evidence: [tests](evidence/tests.txt), [TypeScript](evidence/typecheck.txt), [ESLint](evidence/eslint.txt), [image validation + frontend/server builds](evidence/build.txt), [dependency review](DEPENDENCY_REVIEW.md), [baseline screenshots](evidence/task14b/).

Final automated checks: **264 tests / 40 files PASS**, TypeScript PASS, ESLint PASS, image validator 56/347 PASS, production frontend and server builds PASS. Public static variant is additionally built with VITE_STATIC_DEMO=1 before deployment.

## Fixed within existing architecture

1. Compatible dependency updates: 9 → 5 affected package entries; remaining five are dev-only in lockfile, including two critical. No forced major update. See DEPENDENCY_REVIEW.
2. Friendly Ukrainian messages for network, proxy HTML and 5xx failures; server validation messages preserved for 4xx.
3. Partner export now states customer-paid delivery, Telegram channel, supplier settlement after PACKED/before dispatch, YUNELA reverse delivery; COD explicitly disabled/pending configuration. Adds product name and TEST-only Telegram text draft with visible missing-field stop.
4. Cart/checkout test copy now reflects customer-paid carrier delivery and offline full-payment-only support.
5. Existing Node static handler serves WebP/JSON/text with proper MIME under nosniff. This fixes the server variant; Render static hosting already served these correctly.

Server fixes are in Git/source but **not running on a static Render service**. Publishing this bundle does not make a backend available. Next task must close infrastructure and business gates described in LAUNCH_BLOCKERS.

## Post-deployment verification

Published **592756bd1c9bb124574388bb1d9c2bcc14004e73**, Render **dep-dbhpqmg8v5cc73944i4g LIVE** at 2026-10-29 21:24:43 Europe/Kyiv. Browser reloaded home, catalog and PHOTO-010 detail; order/operator guard and noindex remain. See HANDOFF and evidence/task15. Bundle is `/assets/index-D0BJhH3y.js`. Full public order remains BLOCKED. This section is a docs-only follow-up, not a second deploy.
