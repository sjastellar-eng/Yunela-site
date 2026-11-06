# Micro-task12 — LIST background batch04

Date:2026-10-28 Europe/Kyiv. Branch:fix/list-background-batch-04.
Base/current staging:f6ddcb149b7cc9b0b57f1d5a107b52f028f25020, verified Render LIVE and remote staging ref.

## Input audit and processing
Only LIST-017..021 primary images. All5original masters are opaque RGB WebP1200x1200 with differing embedded warm backgrounds. INPUT_AUDIT.json records original SHA/dimensions/format/alpha/corners; INPUT_OVERVIEW.jpg shows original set.

Unmodified recolour() from approved scripts/background-pilot-six.py, imported by offline scripts/process-list-batch-04.py. Immutable base master source, spatial backdrop estimate, continuous contact-shadow residuals preserved. No generation/global grade/repositioning/composition or scale changes. Dark/contrasted pixels remain exact before encoding. Light edge pixels may receive subtle correction; lossy outputs are not pixel-identical.

## Compression and visual review
Fresh q92 and q95/method6 encodes compared from corrected lossless pixels at identical source coordinates. Selected q92 for all5after inspection of thin/dark/light contours, leaf folds, green product texture and contact shadows: no conspicuous new halos, morphology damage, colour shift or visible compression damage. Fixed primary sourceSku, paths/gallery order,1200 masters and existing480/800 versions retained. Target #FAF9F5; selected decoded corner samples within2RGB levels of250/249/245. Minimum foreground luminance SSIM:0.994166 vs corrected lossless (supports, does not replace visual inspection).

| SKU | Original bytes | q92 selected | q95 |
|---|---:|---:|---:|
| LIST-017 | 523436 | 468430 | 569454 |
| LIST-018 | 521122 | 469496 | 564330 |
| LIST-019 | 556154 | 501540 | 604220 |
| LIST-020 | 462414 | 418240 | 507290 |
| LIST-021 | 518480 | 461990 | 553662 |
| Total15files | 2581606 | 2319696 | 2798956 |

Savings vs original compressed files:10.15%.

## Per-file export sizes
| public/creative file | Original bytes | Selected bytes |
|---|---:|---:|
| LIST-017.webp | 329614 | 276604 |
| LIST-017-primary-480.webp | 56208 | 55982 |
| LIST-017-primary-800.webp | 137614 | 135844 |
| LIST-018.webp | 319746 | 270564 |
| LIST-018-primary-480.webp | 59418 | 58186 |
| LIST-018-primary-800.webp | 141958 | 140746 |
| LIST-019.webp | 345502 | 291924 |
| LIST-019-primary-480.webp | 62854 | 61656 |
| LIST-019-primary-800.webp | 147798 | 147960 |
| LIST-020.webp | 281728 | 240524 |
| LIST-020-primary-480.webp | 54430 | 53528 |
| LIST-020-primary-800.webp | 126256 | 124188 |
| LIST-021.webp | 328404 | 274400 |
| LIST-021-primary-480.webp | 52690 | 52026 |
| LIST-021-primary-800.webp | 137386 | 135564 |

## Validation and delivery
260tests/38files PASS; TypeScript via tsc -b, ESLint, image validator56primary347files and full production frontend/server builds PASS. All15exports decode, dimensions/SHA/corner checks PASS. Scope proof:only15target WebP and corresponding manifest SHA fields changed. Other51SKU, all secondary/texture assets, all non-hash data/sourceSku/order, CSS/catalog/YUNA/business logic unchanged. No runtime/package/lock changes. Existing unrelated worktree files preserved/excluded by isolated checkout.

BEFORE_AFTER.jpg:5full source/final pairs plus leaf/contact-shadow comparisons. LIST-017..021-details.jpg:enlarged native-coordinate source/lossless/q92/q95 comparisons. RESPONSIVE_DETAILS.jpg:all15export detail checks. PROCESSING.json includes every source/export SHA-256, encoding parameter, size, dimensions and metrics. QA_RESULTS.json summarizes checks.

Changed files:15public/creative/LIST-017..021 master/primary-480/800 WebP;2content manifests; scripts/process-list-batch-04.py; docs/DEVELOPER_HANDOFF_LATEST.md; docs/list-background-batch-04 audit/comparison/report files.

GitHub persistence on dedicated fix/list-background-batch-04 branch required. Remote commit tree is verified against tested local tree; SHA availability checked before final delivery. No merge/deploy; staging remains f6ddcb1. No new browser acceptance of this batch claimed before CEO publication authorization. STOP after12; next step CEO visual review, no further SKU.
