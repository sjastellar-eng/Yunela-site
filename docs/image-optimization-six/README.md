# Six-SKU image optimisation — Micro-task 03

Date: 2026-10-26 (Europe/Kyiv)
Branch: fix/background-pilot-six
Lossless reference: f50addfe01a4fcba739bce81d395344f8d5c3d04

## Result

18 files: 9,135,798 → 3,370,082 bytes; saving 63.11%.
Selected WebP lossy quality=98, method=6, no resizing or image retouch.
Composition, canvas, placement, scale, CSS, component code, provenance and
primary/gallery assignments remain unchanged. Only six primary SHA-256 records
and their twelve responsive hashes updated in the existing manifests. Existing
hash-based URL versions invalidate their cache correctly.

Lossless bytes are retained permanently in the reference git commit and copied
into the offline comparison cache. No duplicate lossless assets added to public.
Reproduce candidates: `python scripts/optimize-pilot-six.py`.
Apply reviewed choice: `python scripts/optimize-pilot-six.py --apply 98`.

## Compared encoding modes

| WebP quality | Total bytes | Saving | Lowest foreground luminance SSIM |
|---|---:|---:|---:|
| 88 | 1,835,260 | 79.91% | 0.963476 |
| 92 | 2,335,460 | 74.44% | 0.976562 |
| 95 | 2,816,988 | 69.17% | 0.986537 |
| 98 | 3,370,082 | 63.11% | 0.991647 |

Quality 98 gives the greatest detail retention among tested settings while
exceeding the target reduction. Metrics support the local visual review; they
are not proof that compression is mathematically lossless.

## Every delivery file

| File (public/creative/) | Lossless bytes | Optimized bytes | Saving |
|---|---:|---:|---:|
| LIST-006.webp | 1,046,436 | 376,348 | 64.04% |
| LIST-006-primary-480.webp | 237,490 | 85,758 | 63.89% |
| LIST-006-primary-800.webp | 551,710 | 213,368 | 61.33% |
| LIST-014.webp | 937,954 | 340,780 | 63.67% |
| LIST-014-primary-480.webp | 217,432 | 79,632 | 63.38% |
| LIST-014-primary-800.webp | 502,208 | 192,346 | 61.70% |
| LIST-016.webp | 1,118,458 | 411,514 | 63.21% |
| LIST-016-primary-480.webp | 244,052 | 91,672 | 62.44% |
| LIST-016-primary-800.webp | 583,836 | 226,074 | 61.28% |
| PHOTO-001.webp | 831,786 | 297,414 | 64.24% |
| PHOTO-001-primary-480.webp | 165,176 | 69,996 | 57.62% |
| PHOTO-001-primary-800.webp | 397,048 | 166,538 | 58.06% |
| PHOTO-008.webp | 739,250 | 257,146 | 65.22% |
| PHOTO-008-primary-480.webp | 144,198 | 52,314 | 63.72% |
| PHOTO-008-primary-800.webp | 345,908 | 130,768 | 62.20% |
| PHOTO-010.webp | 645,252 | 225,840 | 65.00% |
| PHOTO-010-primary-480.webp | 125,808 | 43,598 | 65.35% |
| PHOTO-010-primary-800.webp | 301,796 | 108,976 | 63.89% |

## Visual review

LOSSLESS_VS_OPTIMIZED.png contains six paired full images and enlarged equal-area
leaf / factory-lettering details. CANDIDATE_DETAIL_COMPARISON.png shows all five
versions (lossless, 88, 92, 95, 98) as 1:1 pixel crops of contours and shadows.

No obvious new halos, block artefacts, broken fine outlines or loss of packaging
lettering were seen at the reviewed scales for quality 98. Existing shadows
and labels are preserved visually. The backdrop remains visually consistent
with CSS #FAF9F5; decoded corner RGB is 251/249/245 (#FBF9F5), a +1 red-channel
quantisation difference from lossless 250/249/245. The palette/CSS was not changed.

## Executed checks

- All 18 WebP decode, dimensions, candidate SHA-256 and ≤1-channel background
  tolerance checks PASS.
- Exact scope comparison against lossless commit PASS: only 18 primary/adaptive
  files and six manifest records; other 50 SKU and all secondary/texture images
  unchanged; no CSS/component changes.
- 260 tests / 38 files PASS after applying optimized files.
- Image validator PASS: 56 primary, zero pending, all 347 gallery/adaptive files.
- Full frontend and server production build PASS.

No new responsive/browser acceptance claimed. This is image-file visual review,
asset integrity and application regression validation. No PR update, merge,
public deployment or processing of other SKU. Await CEO review.
