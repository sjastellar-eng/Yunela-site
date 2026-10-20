# YUNELA — storefront MVP V2 / offline test

Persistent cart → checkout → order → offline payment → protected operator → customer status. Existing cart/order/PaymentService/SQLite/auth code is reused. No live payments or partner dispatch.

## Run (Node 22.12+, npm)

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
export YUNELA_AUTH_SECRET='local-test-only-change-this-32-character-secret'
export YUNELA_OPERATOR_EMAIL='operator@example.test'
export YUNELA_OPERATOR_PASSWORD='local-operator-test-123'
export YUNELA_TEST_FIXTURES=1
export YUNELA_WEIGHT_FIXTURES=1
export HOST=127.0.0.1
npm start
```

http://127.0.0.1:3000. Example credentials are local test only; change before sharing. Use fictional customer data. Operator page uses the above credentials. Public registration cannot create an operator.

Run from repository root. `YUNELA_DB_FILE` defaults to persistent `data/yunela.sqlite`; memory DB is rejected. Migrations use `database/migrations` or explicit `YUNELA_MIGRATIONS_DIR`. PORT defaults 3000. Built runtime serves UI+API. `npm run dev` proxies API to 3000.

## Catalogue

56 source candidates: 30 photo IDs + 26 supplier price-list rows. No 17-SKU cap. All begin REQUEST, no assumed retail price/stock. Screenshot quotations are partner procurement terms, visible to operators only, not retail. Currency/weight units and names need confirmation. Photos are copied from the supplied ZIP; chat screenshots/PII are not published.

Operator may explicitly confirm a name, quality/right-to-sell, retail UAH price, partner stock and packaging. PREORDER requires confirmed price and terms; only confirmed IN_STOCK is purchasable in the first checkout. Individual China requests are deferred confirmation flows. No owned warehouse or invented physical lot is created.

TEST-ONLY is a clearly labelled synthetic fixture added by YUNELA_TEST_FIXTURES=1. Its price/stock are not supplier claims. Disable the flag to hide it. Historical discovery prototype remains at /#/lab; Finder/Box do not block checkout.

## E2E

Find TEST-ONLY → add/update cart → checkout with fictional name/phone/city/address/postcode → save order → select success/failure offline payment → operator login → QUEUED_TEST → PACKING → SHIPPED (TEST tracking) → DELIVERED → refresh buyer status. Branded packaging is request/confirmation only, not a guarantee. Download partner-task JSON is explicitly simulationOnly=true / dispatchEnabled=false; nothing is sent externally.

Reservations are atomic in partner stock, cancellation releases once, simulated shipment consumes. Restart with the same DB/secret to retain sessions/cart/orders. HTTP E2E and error/security tests: src/api/store-server.test.ts. Full domain regressions remain.

## Limits

NODE_ENV=production is rejected deliberately. Existing PaymentService uses an offline signed test adapter; no Mono network call, settlement, fiscalisation or real refund occurs. Real dispatch, production and merge need separate permission. Unpaid reservation expiry is manual operator cancellation in this MVP; automatic TTL is follow-up. Customer identity is a random hashed bearer session (24h), operator auth uses existing service. No authority from X-Customer-Id. Same-origin mutations and session/login rate limits are present.

Actual retail/stock/QA/packaging agreements remain business launch gates. Build PASS does not mean browser/live merchant PASS. Branded vector wordmark/font licensing remains an asset input; no new logo is introduced.

## Browser acceptance / private staging

Browser automation and closed-staging configuration are now included. Run `npm run build`, `npx playwright install chromium`, then `npm run test:browser`. The runner launches compiled application, uses an isolated persistent SQLite database, creates synthetic buyers, tests desktop and mobile Chromium and restarts the server. It writes screenshots and results into ignored `artifacts/browser`. An existing Chromium can be selected with `YUNELA_CHROMIUM_PATH`.

Private staging setup: [staging/README.md](staging/README.md), Dockerfile.staging, staging/compose.yaml and staging/environment.example. All storefront pages/assets/API require the staging password; operator credentials remain separate. Staging requires explicit persistent DB, strong non-placeholder credentials and HTTPS origin (localhost exception only). Defaults bind localhost. Docker/TLS hosting still require a compatible existing server; no public URL has been deployed.

Latest acceptance details: [docs/browser-staging-acceptance.md](docs/browser-staging-acceptance.md). Original validation describes the earlier baseline, before this browser acceptance.

## V4 weight-commerce test implementation

See [docs/v4-test-operations.md](docs/v4-test-operations.md) for Product JSON dry-run import, immutable policy versions, weight pricing, protected quotes, gram reservations and internal partner/refund simulations. Enable YUNELA_WEIGHT_FIXTURES=1 together with YUNELA_TEST_FIXTURES=1 for the explicit synthetic weight product. `npm run test:browser:weight` is separate from the preserved fixed-SKU browser regression. No live merchant/partner integration is enabled.
