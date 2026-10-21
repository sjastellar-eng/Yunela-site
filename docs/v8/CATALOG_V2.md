# Catalog V2 integration

Base: d423c0267d3dc412d34dd1df58c02c28e039f357, Draft PR #23.
Branch: feat/catalog-v2-sommelier-readiness. Main and existing Render demo are unchanged.

## Imported content
56 distinct sourceSku records, Ukrainian names, short/full descriptions, taxonomy, brewing guidance, evidence status, source links, provisional canonical IDs and nine unresolved relationship groups. No records merged. 52 records have disclosed style guidance; four have identity-only content. PHOTO-014 remains red tea; similar LIST-014/015/017 remain distinct.

Raw intelligence is INTERNAL_CONTENT_PRODUCTION_NOT_PUBLIC_MANIFEST. Only the informational projection is exposed. Original publication, sales and recommendation approval flags remain false. This development preview is not commercial release approval. Source supplier images already present at baseline remain unchanged; their rights are not newly approved.

Prices, inventory and commercial data are null; confirmed=false. No real order or payment path is enabled. Style descriptions and editorial brewing recipes do not establish sensory characteristics of a lot.

## Import
Run from repository root, with source files outside the repository:

```sh
node scripts/catalog-v2-import.mjs --csv /path/YUNELA_PRODUCT_CONTENT_UA_V2.csv --sensory /path/YUNELA_SOMMELIER_SENSORY_DATA_V2.json
# Inspect dry-run, then:
node scripts/catalog-v2-import.mjs --csv /path/YUNELA_PRODUCT_CONTENT_UA_V2.csv --sensory /path/YUNELA_SOMMELIER_SENSORY_DATA_V2.json --apply
```

Exact 56 identities, CSV/JSON texts, source references, evidence and duplicate mappings must agree. Import is atomic and idempotent; malformed or inconsistent input is rejected. XLSX catalog was independently cross-checked against CSV: 56 names, categories, short descriptions and canonical IDs matched.

## Creative assets
`content/creative-images.v1.json` reserves 26 LIST slots. No new Creative files were provided. For an approved asset, place bytes in public/creative, then set path, sha256, alt, rightsStatus=COMMERCIAL_USE_APPROVED, assignmentStatus=APPROVED_FOR_SKU, publicationAllowed=true and kind=EDITORIAL_ILLUSTRATION or VERIFIED_PRODUCT_PHOTO. A product photo additionally requires productIdentityConfirmed=true. Unknown SKU, duplicate mapping, unsafe path, missing file, wrong checksum or missing rights fail import. Re-run the importer; no UI source edit required. An illustration must not be described as an actual supplier lot photo.

## Sommelier
Existing Recommendation Engine is preserved. `assessSommelierReadiness` is a gate, not a replacement recommender. All 56 current records are ineligible: provisional identity, no approved lot evidence, null measured sensory fields. No null-to-50 coercion, synthetic catalog records or invented availability are passed to the engine. Future adapter requires confirmed identities, approved lot evidence and all seven verified fields before engine integration. Questionnaire, personal profile and AI dialogue are not implemented by this task.

## Validation
npm ci; typecheck; lint; npm test; full build; static build. Browser check script: scripts/catalog-v2-browser-e2e.mjs, CHROME_PATH may specify installed Chrome. Covers 390px mobile and 1440px desktop, 56 cards, disabled commerce, SKU search, detail navigation, brewing, corrected taxonomy, horizontal overflow, JS errors and absence of API requests. Artifacts are generated in artifacts/v8 (ignored).

Remaining approvals: lot/identity/sensory validation for recommendations; actual commercial values and sales approval; Creative asset delivery and rights confirmation. Static demo has no backend, persistent customer history or commerce.
