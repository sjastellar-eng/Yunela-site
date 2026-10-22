# YUNELA V9.1 — UX polish and Creative integration

Base verified: PR #25 is draft/unmerged at 5d1964e625212fa5e66bdc7fcc0bcb6de1086861. Work branch: feat/storefront-ux-v9-1. The first commit publishes CREATIVE_CONTRACT.md so asset work can target this branch. Main, V9 and earlier demos remain untouched.

| Direction | Delivered behavior |
|---|---|
| Homepage | V2 black palette/fonts/hero preserved; mobile section spacing, featured cards, CTA and navigation refined, including a collapsed menu at tablet widths |
| Catalog | All 56 sourceSku and original Product V2 records preserved; stronger imagery, concise excerpts, clear loading/empty states, sort/search/category and session selection |
| Oolong content | All LIST-013–024 present with existing Ukrainian title/short or buyer introduction/full style text/taste/processing/brewing; source notes are below the main content |
| Images | Safe sourceSku manifest overlay, local files, alt text, illustrative labels, byte/checksum/approval checks and broken-image fallback; Creative V6.5 PR not present at initial/second check |
| YUNA | Shorter Ukrainian replies, mobile chat/question tabs, visual cards, refine/compare/save, product context and return-to-results; explicit rule-based demo status |
| Staging | Separate Render Static Site for this branch; existing V9 demo is not overwritten |

## Product content ownership and integrity
No product record, evidence, price, inventory, canonicalTeaId, sourceSku, duplicate group or approval flag is changed. The read-only presentation layer removes redundant name prefixes and translates service wording. For identified oolong styles it uses the existing Product Director buyer introduction as the short display text; ambiguous identity/composition keeps the source short description. Full introductory style paragraphs come from Product V2. Repeated buyer/taste/recipe sections are separated in the UI, and the complete original text remains available under “Про опис і джерела”. These are presentation choices, not new product research or verified tasting notes.

Abbreviation qualifiers are shown as a human-readable note rather than a long title suffix. Conditional brew warnings are retained for LIST-013 (readiness) and LIST-021 (composition). THREE Shui Xian records remain separate; differences are not invented. Personal recommendations/commerce remain gated.

Product Director follow-up needed for actual lot facts: full identity/readiness of LIST-013, expansion of LIST-016, Chinese identity of LIST-020, complete ingredients and infusion suitability of LIST-021, origin/height of LIST-022, base tea/process of LIST-023 and lot/package distinctions for LIST-014/015/017. This preview does not substitute guesses for those documents.

## Creative technical boundary
Creative owns image creation, selection, morphology, approval and upload. The contract is CREATIVE_CONTRACT.md. Developer did not generate, crop, select or relabel product photos.

Creative changes public/creative files and content/creative-images.v1.json in an asset-only Draft PR. A runtime join changes only image/path metadata by exact sourceSku. It rejects duplicate assignments, foreign paths, mismatched filenames and missing approval. Approved image URLs carry a checksum revision, so replacement does not require product/UI code edits. ILLUSTRATIVE and EDITORIAL_ILLUSTRATION are visibly labeled, never described as documentary lot photos. VERIFIED_PRODUCT_PHOTO requires identity confirmation.

`npm run validate:images` checks known SKU, unique entry, local path, matching filename, approval metadata, file existence, SHA-256, 2 MiB size and file signature. It checks transport integrity, not morphology, rights ownership or approval authenticity. `npm run build` runs it first, so the existing CI checks it without workflow permission changes. Render build must also run it. No approved files currently means 0 approved Creative images, 26 pending entries; a passing validator does not mean photographs were delivered.

## Existing behavior retained
The server AI provider port and its authorization/rate/deadline/output checks are unchanged. No AI provider, paid service, live checkout, price or partner dispatch is enabled. The V9 state/profile schema, local opt-in save/delete and analytics privacy boundary remain. The legacy backend storefront retains its commerce UI path; the new detail layout is for static preview. Source-data gates and Recommendation Engine are not relaxed.

## Validation and reproduction

```sh
npm ci
npm run typecheck
npm run lint
npm run validate:images
npm test
VITE_STATIC_DEMO=1 npm run build
CHROME_PATH=/path/to/chrome node scripts/v9-1-browser-e2e.mjs
DEMO_URL=https://PREVIEW.onrender.com CHROME_PATH=/path/to/chrome ARTIFACT_DIR=artifacts/v9-1-live node scripts/v9-1-browser-e2e.mjs
```

The V9 browser entrypoint remains a wrapper to the expanded runner. Existing scenarios remain: 56 IDs, sort/filter/search, empty state, selection, real result IDs, comparison, medical-claim refusal, saved profile deletion, unavailable storage, no API requests and disabled purchases. New coverage adds 360/390/430/768/1440 widths, 12 oolong details, product context, return navigation, image components and deliberate broken-image fallback. Unit tests cover immutable catalog overlay, rejected/mismatched/duplicate image metadata, actual checksum mismatch and preservation of conditional product facts.

Mobile screenshots contain only demo products, no personal/payment information. Physical Android and genuine network/device performance are not claimed by viewport tests.
