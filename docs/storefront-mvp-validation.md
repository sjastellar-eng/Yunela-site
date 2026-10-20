# Storefront MVP verification — 2026-10-13

Local branch feat/storefront-mvp-v2, integration baseline 93d30a52f303a5ba0543152bb0c065c43ce4b14b.

Actual checks: npm run typecheck PASS; npm run lint PASS; npm test PASS (203 tests, 28 files); npm run build PASS.

Built-runtime HTTP smoke PASS: 57 catalogue entries (56 unconfirmed supplier candidates + explicit synthetic fixture), static UI served, customer session/cart/checkout, persistent SQLite order, offline payment, protected operator queue/packing/shipping/delivery, buyer final status DELIVERED. Partner dispatch disabled. HTTP integration tests also cover database reopen, authorization, reservation races, idempotency, payment decline, cancellation, malformed inputs and candidate confirmation.

Browser visual/click E2E NOT VERIFIED: Chromium was unavailable and downloads failed. The smoke is HTTP against compiled application, not a browser test. Existing suite emits Vite websocket/esbuild shutdown warnings; all assertions passed.

Installation in this runtime required extracting Node headers with --no-same-owner and npm ci --nodedir=/tmp/yunela-node-headers/node-v24.19.0 because native dependency header extraction failed. Native SQLite subsequently compiled and passed persistence tests. README gives standard installation on supported Node.

Not verified or enabled: live payment/acquiring, external partner dispatch, production infrastructure, retail/availability verification of supplier candidates, final branded packaging, automatic expiry of unpaid reservations. Operator can cancel unpaid orders manually. Synthetic test prices are not supplier prices. Candidate procurement notes never become public retail prices.

No production deployment, main merge, partner order or actual payment performed. See README for reproducible local run and scripts/smoke-store.mjs for guarded offline smoke.
