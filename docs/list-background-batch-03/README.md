# Micro-task10 — LIST background batch03

Date:2026-10-27 Europe/Kyiv. Branch:fix/list-background-batch-03.
Base/staging:0e04f80246441745077e788a357328c7a1848085. Render current LIVE verified.

## Audit and preserved pilot
Audited LIST-012..016:opaque RGB WebP with existing primary/responsive assignments. Only LIST-012/013/015 require embedded backdrop correction. LIST-014/016 primary masters and480/800 exports are byte-identical to accepted pilot87955d6; all6public files fetched from staging match SHA-256. Their corners are RGB251/249/245 (#FBF9F5), accepted WebP quantization +1red from design target #FAF9F5. They are verified and NOT reprocessed; image bytes and manifest records remain identical. INPUT_AUDIT.json records dimensions/corners/sizes/SHA and public verification.

## Method and quality
Unmodified recolour() from approved scripts/background-pilot-six.py. Immutable base source, smooth spatial backdrop correction and continuous source shadow residuals. No generation, global grade, repositioning, composition or scale change. Contrasted/dark pixels stay exact before encoding. Subtle correction of light subject edge pixels possible; lossy output is not pixel-identical.

Compared fresh WebP q92/q95 method6 from corrected lossless. Same-coordinate light/dark leaf and shadow crops reviewed for all3, selected q92 after no conspicuous new halos, morphology/detail damage, subject colour shift or posterized shadows observed. Master1200x1200 and existing480/800 exports retained. Selected corner samples within2RGB levels of250/249/245. Minimum foreground luminance SSIM:0.994505.

| Changed SKU | Original bytes | q92 selected | q95 |
|---|---:|---:|---:|
| LIST-012 | 482354 | 435156 | 520542 |
| LIST-013 | 479316 | 436696 | 518106 |
| LIST-015 | 591224 | 527160 | 632092 |
| Total9files | 1552894 | 1399012 | 1670740 |

Saving vs original compressed files:9.91%.

## Individual exports
| public/creative file | Original bytes | Selected bytes |
|---|---:|---:|
| LIST-012.webp | 293278 | 249106 |
| LIST-012-primary-480.webp | 55582 | 55274 |
| LIST-012-primary-800.webp | 133494 | 130776 |
| LIST-013.webp | 296630 | 254470 |
| LIST-013-primary-480.webp | 52530 | 51538 |
| LIST-013-primary-800.webp | 130156 | 130688 |
| LIST-015.webp | 363072 | 302414 |
| LIST-015-primary-480.webp | 66370 | 65568 |
| LIST-015-primary-800.webp | 161782 | 159178 |

## Validation and evidence
260tests/38files PASS; TypeScript via tsc -b, ESLint, image validator56primary347files and full frontend/server production build PASS. Decode/dimension/hash checks and scope proof PASS. Only9WebP plus matching SHA fields changed. All other53SKU, including014/016, sourceSku/gallery order, every secondary/texture, non-hash data/CSS/catalog/YUNA/business logic unchanged.

BEFORE_AFTER.jpg:3full before/after pairs and leaf/shadow crops. LIST-012/013/015-details.jpg:source/lossless/q92/q95 native-coordinate comparisons. RESPONSIVE_DETAILS.jpg:all9export comparisons. INPUT_OVERVIEW.jpg:all5audited primary images, with two marked preserved. PROCESSING.json includes source/output SHA-256, dimensions, bytes, metrics/corners/tool versions. QA_RESULTS.json summarizes test and scope evidence.

## Changed files
9public/creative/LIST-012,LIST-013,LIST-015 master/primary-480/800 WebP;2content manifests; scripts/process-list-batch-03.py; docs/DEVELOPER_HANDOFF_LATEST.md; docs/list-background-batch-03 evidence/report files. No runtime dependencies, UI or CSS changes.

GitHub persistence on dedicated branch; API-created remote commit has same complete tree as tested local checkpoint (metadata may differ). No merge or deploy; staging remains0e04f802. New browser acceptance not claimed before CEO staging authorization. STOP for CEO visual review; do not process additional SKU.
