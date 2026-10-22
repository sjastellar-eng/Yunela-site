# Creative V6.5 → Storefront V9.1

Integration target: `feat/storefront-ux-v9-1`, based on V9 `5d1964e625212fa5e66bdc7fcc0bcb6de1086861`. Main and V9 PR #25 are not integration targets.

Creative owns generation, selection, morphology, SKU attribution and asset approval. Developer validates files, identifiers, manifests, rendering and staging only.

## Files Creative may change
- `public/creative/LIST-013.webp` … `LIST-024.webp` first; remaining LIST records later.
- `content/creative-images.v1.json`: update the existing entry for each sourceSku.
- Optional provenance/QA document under `docs/creative/`.

Please keep UI, catalog text, financial fields, sourceSku and recommendation flags unchanged. Create a Draft PR targeting the V9.1 branch; no main merge. A compatible asset-only PR can be incorporated into the V9.1 preview branch after technical review.

## Metadata
Each existing entry has sourceSku, path, kind, rightsStatus, assignmentStatus, publicationAllowed, alt and sha256. Approved assets need:

```json
{
  "sourceSku": "LIST-013",
  "path": "/creative/LIST-013.webp",
  "kind": "EDITORIAL_ILLUSTRATION",
  "rightsStatus": "COMMERCIAL_USE_APPROVED",
  "assignmentStatus": "APPROVED_FOR_SKU",
  "publicationAllowed": true,
  "alt": "Ukrainian description supplied and checked by Creative",
  "sha256": "actual SHA-256 of the file"
}
```

The value above is a schema example, not approval of LIST-013. `ILLUSTRATIVE` is supported as an explicit illustration status. Neither label claims a documentary lot photo. VERIFIED_PRODUCT_PHOTO additionally requires productIdentityConfirmed=true. Do not set approval flags for rejected/pending assets. Keep path=null and publicationAllowed=false until approval. Fields are independent of sales approval.

Use local WebP, JPG or PNG; preserve the exact sourceSku in the filename, including zero padding. A suffix such as LIST-013-v2.webp is allowed. Prefer about 1200 px or larger, neutral product background, consistent scale and optimized bytes; technical file limit is 2 MiB. Morphology/quality decisions remain with Creative.

## Rendering and validation
V9.1 joins this manifest to the catalog by sourceSku; original catalog IDs/content/evidence and commerce fields stay untouched. An unapproved, mismatched, missing or broken image uses a neutral fallback. Illustrations are labeled in cards, detail and YUNA. No default substitution from a different SKU.

Run `npm run validate:images` once the V9.1 validator lands, then existing lint/typecheck/tests/build. The validator checks identifiers, approval metadata, file signature, size, existence and checksum; it does not certify morphology or legal ownership. Developer performs mobile and browser rendering review before staging.
