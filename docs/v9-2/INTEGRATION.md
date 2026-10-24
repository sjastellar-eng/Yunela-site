# V9.2 Creative V8.4 integration

Baseline PR #26: 20974f23adff0f09f6532e02a5d168478b09c966. Reviewed Creative PR #27: 23f45fc5dc82063b220baa9a6cc021352019ed1a. Its diff contains 26 LIST images and asset documentation/manifest; no application code. No merge is performed; this independent branch selectively imports verified asset bytes from the supplied ZIPs.

## Rights decision
CEO stated “Разрешение есть” on 2026-10-23 at 18:06:37 UTC in the project conversation. This is recorded as REPORTED_BY_CEO, not an independently examined supplier contract. The V9.2 directive authorizes applying the supplier's permission only to its own supplied photographs.

29 PHOTO primaries have underlyingOrigin=SUPPLIER PHOTO, wrappedProduct=true and original PHOTO-input provenance. Their derived public registry uses SUPPLIER_PRODUCT_PHOTO, supplierAuthorized=true and evidence id CEO_SUPPLIER_PERMISSION_2026_10_23. This does not verify current lot identity or authorize sales. Original UNVERIFIED identity confidence for PHOTO-002/008/011/024 remains unchanged. None is relabeled VERIFIED_PRODUCT_PHOTO.

PHOTO-012 remains BLOCKED: the Creative primary derives from THIRD PARTY REFERENCE at daochai.ru. Supplier permission does not cover this separate photographer. Provide an authorized supplier-owned wrapper photograph or the rights holder's permission. No AI unwrapped cake or secondary is promoted to primary.

## Integration
56 stable sourceSku; 55 permitted primaries (26 LIST illustrations + 29 real supplier wrappers); 129 master/gallery images and 344 supplied master/adaptive WebP files. All images are byte-for-byte Creative exports, not regenerated or cropped by Developer. LIST and AI secondary images remain ILLUSTRATIVE and visibly labeled. Additional frames retain the Creative gallery order.

Catalog, search, detail, existing cart UI and YUNA use one primary resolver. Selecting a gallery thumbnail never changes the primary. Missing/blocked/invalid primary metadata fails closed. Responsive variants use checksum-versioned URLs, supplied dimensions, alt text, lazy loading, contain framing and neutral error states. The gallery uses accessible thumbnail buttons.

Only explicitly approved files enter public/creative. QA/SOURCES, raw reference URLs, internal records and the private full ZIP remain outside public resources. Legacy public/catalog image duplicates are removed from this branch so PHOTO-012 cannot bypass its rights gate. Earlier deployments/history remain intact.

Source catalog names, category (including PHOTO-014 pressed red tea), confidence, sourceSku, prices, sales/payment flags and business rules are unchanged. No main merge or live commerce is authorized.

## Reproduction
Use scripts/import-creative-v84.py with --public, --full and the explicit --ceo-supplier-permission flag. Then run npm ci, npm run validate:images, npm run typecheck, npm run lint, npm test and VITE_STATIC_DEMO=1 npm run build. Run existing V9.1 browser regression and V9.2 gallery tests with CHROME_PATH pointing to a local Chromium executable. Final test/deployment evidence belongs to the final PR report; a partial asset checkpoint is not an accepted or deployed build.
