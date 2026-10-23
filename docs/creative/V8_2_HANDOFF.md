# Creative V8.2: rights-gated image handoff

The private production package `YUNELA_PRODUCT_PHOTOGRAPHY_V8_2.zip` contains real processed photographs and preserved originals. It must not be committed to this public repository. Available evidence establishes no commercial-use permission, so this PR publishes zero photographs and changes no storefront code or active image manifest.

## Inventory

- 56 sourceSku reviewed; 44 have internal primary candidates: 30 original wrapped PHOTO products and 14 loose-tea LIST products.
- 115 core processed WebP: 88 candidate gallery images and 27 unassigned research studies; 88 responsive derivatives; 149 preserved originals.
- 12 LIST records have only ANALOG sources and no assigned primary: LIST-002, LIST-006, LIST-008, LIST-010, LIST-013, LIST-014, LIST-015, LIST-017, LIST-020, LIST-021, LIST-022, LIST-023.
- All 149 source photographs remain RIGHTS UNKNOWN. Publication eligibility is zero. Expert morphology approval does not establish copyright permission or supplier-lot identity.
- PHOTO-002, PHOTO-008, PHOTO-011, PHOTO-024 retain unresolved taxonomy. PHOTO-014 remains pressed red tea. No catalog values changed.

## Integration contract

Read against `docs/v9-1/CREATIVE_CONTRACT.md` at 20974f23adff0f09f6532e02a5d168478b09c966 on `feat/storefront-ux-v9-1`. The adjacent image_manifest.json is an inactive handoff snapshot in the real `creative-images-v1` schema, not an update to `content/creative-images.v1.json`. All 56 paths are null and publicationAllowed=false; the native validateImageManifest validator accepts these pending entries. A passing pending manifest does not certify photographs or grant rights.

For future approved files: copy only cleared original product photography to `public/creative/sourceSku.webp`; supply actual checksum, Ukrainian alt, COMMERCIAL_USE_APPROVED, APPROVED_FOR_SKU, publicationAllowed=true and productIdentityConfirmed=true for VERIFIED_PRODUCT_PHOTO. Never promote TYPE MATCH or ANALOG into verified product identity without evidence.

Fixed primary: PHOTO*=original factory WRAPPED, including pressed red PHOTO-014; LIST*=actual loose dry tea. Unwrapped/texture/wet are secondary, never automatic fallback primaries. Single-photo products remain valid.

The current contract/runtime provides one image slot per sourceSku, with no gallery API. Private `gallery_handoff.json` preserves the requested order; secondary integration needs a separately agreed contract extension. Existing `/catalog/` image routing also needs a Developer rights-gate review before launch; this Creative PR does not modify runtime behavior.

## Validation and review

Private package includes per-file source/crop/mask/checksum metadata, rights_registry.csv, validation_summary.json, pilot BEFORE/AFTER and complete contact sheets. Files use lossless sRGB WebP without generating product details. Native low-resolution exceptions and final contour-review requirements are explicit. Product and packaging pixels are checked against the documented original crop and proportional downscale in opaque retained regions; this check cannot prove a perfect semantic mask.

No backend, payment, prices, names, categories, YUNA or UI changes. No merge or deployment. This is a preparation handoff, not approval to publish or a claim that all 56 products are production-ready.
