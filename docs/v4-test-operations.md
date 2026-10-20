# V4 — private test storefront

Baseline: Visual V2 f9ca9d0. Task V4 is development authorization, not commercial release. Test policy CEO-V4-TEST-1: min20g, step5g, portion max=floor((wholeGrams-1)/step)*step; WHOLE exactly wholeGrams; CP target5000 minor after CAC25000 minor. Coupons/free delivery disabled; no universal minimum basket. Other expense parameters are CFO V5 modelling assumptions, not supplier charges or confirmed taxes. Partner owns stock; commercial_records gram availability is a partner confirmation/reservation mirror, not a purchased warehouse/TeaLot.

## Reproduce

Use supported Node and existing npm package lock. From repository root:

```bash
npm ci
npm run typecheck
npm run lint
npm test -- --maxWorkers=1
npm run build
npx playwright install chromium
npm run test:browser
npm run test:browser:weight
```

An installed browser may be selected via YUNELA_CHROMIUM_PATH. Both runners create isolated synthetic SQLite databases and random test credentials; no external dispatch or banking occurs. Default outputs artifacts/browser and artifacts/weight-browser. In constrained root containers browser launch uses no-sandbox only for isolated QA; do not treat it as hosting configuration.

For a manual preview follow staging/README.md and add YUNELA_TEST_FIXTURES=1 and YUNELA_WEIGHT_FIXTURES=1 to enable explicit TEST-WEIGHT. Set separate local secrets/operator credentials; never commit them. Database defaults to repository data/yunela.sqlite (container /app/data/yunela.sqlite); reuse file/secret on restart. Real NODE_ENV=production remains rejected. No deployment performed by this task.

## Catalog and policy without source edits

Operator login → JSON catalog file → dry-run preview → confirm test import. Operator API POST /api/store/operator/catalog/import accepts {items:[...],dryRun:true}; false commits atomically. Max1000 rows/2MB. Reviewable payload imports/product-v2-candidates.json contains 56 BLOCKED candidates, no commercial approvals/curves/stock/lot; it is not auto-published. scripts/convert-catalog.py converts the supplied Product V2 workbook via Python/openpyxl; no workbook engine is required by the server. Neither possible duplicate IDs nor provisional canonical IDs are merged. Metadata preserves source evidence, not purchaseable prices. Test records must explicitly set testFixture, approvedForTest, canonicalTeaId, lot, curve, gram stock and packaging. UNKNOWN/NULL do not grant approval. Approval of real (non-synthetic) commercial selling is deliberately not implemented/enabled by test import.

sourceSku is stable; row version immutable. Same payload is idempotent; same version with changed payload fails. New version updates existing sourceSku; NULL cannot erase approved commercial fields, gram stock cannot fall below reservations. Dry-run does not insert partner rows. Existing source seeding uses INSERT OR IGNORE and does not overwrite imports on restart. Reimporting unchanged payload does not reset consumed gram stock. Synthetic fixture bootstrap also does not reset stock after restart.

Policy UI accepts JSON preview and activates an immutable new version through POST /api/store/operator/policies. Required schema is exported as DEVELOPMENT_POLICY in src/application/flexiblePricing.ts. Configurable expenses, bps risk/revenue deductions, min/step, CP, CAC, quote TTL; coupons/freeShipping must remain false. Policy mutations require a new version; old orders retain snapshots. Operational contract/SLA/channel still UNKNOWN.

## Money and packages

CFO anchors remain P25/P50/P100/PWhole; A50=min(P50,2*P25), A100=min(P100,2*A50). Piecewise linear CFO V5, including extension20–25g; WHOLE has separate original price. BigInt rational arithmetic, retail ceiling to a kopeck. Purchase cost is C*w/W for the chosen mass, never full-piece pre-purchase. Landed uses CFO physical-risk provision + materials/inbound; incremental floor applies only to portions. CP guard applies once per order with one CAC and one parcel. COGS/supplier estimate are conservatively rounded up per package to minor units before CP; this may reduce CP by less than one kopeck per package versus fractional CFO workings. This is a test calculation, not a supplier settlement rounding agreement.

One WEIGHT line per source/lot is one combined packet; POST adds mass then reprices combined mass, PATCH replaces mass. WHOLE is a separate line and can have multiple pieces. Combining 20+100g into120g does not charge two packages; distinct gift packets/multi-parcel delivery remain deferred pending explicit rules. Same tea with unresolved source aliases is NOT merged by guess. Stock/reserved are grams; checkout transaction reserves all lines of the same source together. quote fingerprint contains quantities/mass, price/catalog/policy version and current price. A changed quote requires explicit re-entry from cart. Existing fixed-SKU synthetic fixture requires explicit YUNELA_LEGACY_FIXED_SKU_TESTS=1 (set by the historical browser runner) and is hidden/rejected by default; it is not weight-commerce economics. Compatibility HTTP tests explicitly use legacy catalog mode; runtime defaults require complete commercial records for non-fixture products.

Customer API removes supplier invoice/landed costs, per-pack/internal supplier costs and economics assessment. Operator views retain financial snapshots; partner export contains agreed purchase basis but no CAC/margin/customer taste history. order_items retain commercial JSON and order_commercial_snapshots retains quote/economics/policy version. No existing order is repriced by later imports.

## Internal partner workflow and refunds

Only operator, simulated: PREPARE_TEST → SEND_TEST → ACK_TEST → PACK_TEST → PACKED_TEST → SHIP_TEST → DELIVER_TEST. One stable order/rev/command, repeat same action idempotent; invalid/stale revision rejected. Export never sends anything. Carrier/contact/payer fields remain UNKNOWN where not supplied; no real ACK/SLA is claimed. ACK and PACKED require line/grams/package evidence; mismatch stops. SHIP additionally requires simulated tracking/carrier acceptance flag, and consumes gram reservation once. Refusal/STOP before shipment releases grams once; paid refusal creates REQUESTED test refund. refund-test marks SIMULATED_SUCCEEDED, never calls bank. Before handoff cancel-test handles unpaid and paid orders; active workflow requires STOP instead. Cancelled orders reject late payments. After shipment returns/partial refunds/settlement require operational decisions and are not simulated as a simple pre-shipment cancel.

A pending offline payment attempt is reused across different retry keys; paid/cancelled orders cannot start another payment. Existing PaymentService still verifies amount/reference/signature and records purchase once. No provider sandbox/live endpoint, merchant secret, refund banking instruction or actual partner communication is invented. Health reports offline-test/dispatch disabled. Enabling real bank or partner channel is outside this release.

## Source and delivery boundaries

Local commits on feat/partner-fulfillment-p0-v4; no GitHub branch/PR because the verified V2 ancestry is only in bundle and no authenticated git push workflow is available (origin is local bundle; gh unavailable). Do not create a misleading PR over main that omits its unpushed storefront ancestry. Deliver complete bundle instead; review/publish branch later through the owner's correct Git workflow. No merge/deployment. Render is the selected future target; no other host provisioned.
