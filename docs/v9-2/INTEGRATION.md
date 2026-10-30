# V9.2 Creative V8.4 integration

Baseline PR #26: 20974f23adff0f09f6532e02a5d168478b09c966. Creative PR #27: 23f45fc5dc82063b220baa9a6cc021352019ed1a. PR #28 stays Draft and unmerged.

## Rights and provenance

CEO reported supplier permission on 2026-10-23 at 18:06:37 UTC. On 2026-10-25 CEO explicitly instructed publication of the missing puer PHOTO-012 and stated permission exists. That specific permission is recorded as CEO_PHOTO_012_PERMISSION_2026_10_25, REPORTED_BY_CEO. Its underlying source remains THIRD PARTY REFERENCE; this does not turn it into supplier-owned photography or independently reviewed legal evidence. The archived original wrapper photo for Lao Tong Zhi 9978 was recovered from repository history, then edited to match the other white-background packshots. No unwrapped cake substitutes for a wrapped primary.

All 30 PHOTO primaries have white-background edits and remain ILLUSTRATIVE, documentary=false; source hashes and processing are recorded in WHITE_BACKGROUND_RETOUCH.json. Identity uncertainty for PHOTO-002/008/011/024 remains unchanged. No current batch is verified. LIST primary bytes remain the supplied Creative exports, with ILLUSTRATIVE metadata. Visible AI badges were removed at CEO request.

## Integration

56 stable sourceSku, 56 permitted primaries, 130 master/gallery images and 347 master/adaptive WebP files. Catalog, search, detail, cart and YUNA share one fixed primary resolver. Gallery selections never change primary. Responsive assets have checksum-versioned URLs, supplied dimensions, alt text, lazy loading and neutral error states.

Loose-leaf LIST images now fill their rectangular containers with object-fit:cover and zero padding, so the original photographic background reaches the edge without a gray frame or geometric distortion. This applies consistently to catalog, search, detail, thumbnails, cart and YUNA. Wrapped PHOTO primaries retain contain framing to show complete packaging on white.

Only approved assets enter public/creative. QA/SOURCES and private references remain excluded. Product names, sourceSku, categories (including pressed red tea PHOTO-014), prices, recommendation rules and commerce flags are unchanged. No merge, payments or real order acceptance is authorized.

## Validation

Run npm run validate:images, npm run typecheck, npm run lint, npm test, VITE_STATIC_DEMO=1 npm run build. Image validation checks every master and responsive file, assignment, rights, hashes, WebP signature, size, duplicate paths and fixed-primary linkage. Browser acceptance checks all 56 SKU and 130 gallery frames at mobile and desktop sizes; actual run results are recorded in the PR report.

The original import script reproduces the initial supplied package integration; subsequent CEO retouches and PHOTO-012 permission are documented overrides in the current registry, not a new export of that original package.
