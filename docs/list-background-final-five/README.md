# Micro-task 14A — final five LIST backgrounds

Branch: `fix/list-background-final-five`. Base: `3e87ade2d073332c6e181fae8d755f5d40a4780d`.

**READY for CEO visual acceptance. No deploy or merge.**

The cancelled Task14 worktree contained unrelated PHOTO edits and experimental history. A fresh worktree/branch was created directly from the confirmed staging SHA. Only verified LIST-022–026 primary/480/800 bytes from checkpoint A were extracted, without another encode. The new commit has the staging base as its only parent; PHOTO commits and changes are excluded. Existing experimental branches/worktrees were left untouched.

Unchanged approved pilot recolour(): target #FAF9F5, preserved dark/contrasted source pixels before encoding, continuous contact-shadow residuals, no generation, global grade, rescale, crop or repositioning. Light edge pixels can receive subtle backdrop correction. Lossy WebP pixel identity is not claimed. SourceSku, paths, gallery order, dimensions and all non-hash metadata remain unchanged.

Fresh q92/q95 method6 candidates from that immutable source were previously compared for each master and responsive size. The same approved q92 bytes were reused. All five full comparisons and enlarged contours/leaf texture/contact shadows were reviewed. q92 gives the smaller file without conspicuous visible degradation; q95 does not justify the larger package. Corner tolerance: <=2 RGB levels from250/249/245. Shallow background texture/shadow residuals are intentionally retained.

## Size comparison

Totals per SKU include primary +480 +800. All values are bytes.

| SKU | Before | Selected q92 | Compared q95 |
|---|---:|---:|---:|
| LIST-022 | 457462 | 415666 | 497796 |
| LIST-023 | 502110 | 454472 | 542022 |
| LIST-024 | 658922 | 592738 | 702268 |
| LIST-025 | 537412 | 480480 | 573892 |
| LIST-026 | 559724 | 508024 | 606186 |
| **Total** | **2715630** | **2451380** | **2922164** |

Saving: **9.73%**. WebP quality92, method6; primary1200×1200 and variants480×480/800×800.

## Per-file sizes

| File | Before bytes | After bytes |
|---|---:|---:|
| LIST-022.webp | 278588 | 239326 |
| LIST-022-primary-480.webp | 52434 | 51686 |
| LIST-022-primary-800.webp | 126440 | 124654 |
| LIST-023.webp | 308782 | 262218 |
| LIST-023-primary-480.webp | 55950 | 55202 |
| LIST-023-primary-800.webp | 137378 | 137052 |
| LIST-024.webp | 404488 | 343712 |
| LIST-024-primary-480.webp | 73144 | 71778 |
| LIST-024-primary-800.webp | 181290 | 177248 |
| LIST-025.webp | 334152 | 280100 |
| LIST-025-primary-480.webp | 58590 | 57826 |
| LIST-025-primary-800.webp | 144670 | 142554 |
| LIST-026.webp | 341546 | 290998 |
| LIST-026-primary-480.webp | 65194 | 64756 |
| LIST-026-primary-800.webp | 152984 | 152270 |

## Visual evidence

[All five BEFORE / AFTER](BEFORE_AFTER.jpg) · [Responsive 480/800 details](RESPONSIVE_DETAILS.jpg)

- [LIST-022 enlarged source/corrected/q92/q95 contours and shadows](LIST-022-details.jpg)
- [LIST-023 enlarged source/corrected/q92/q95 contours and shadows](LIST-023-details.jpg)
- [LIST-024 enlarged source/corrected/q92/q95 contours and shadows](LIST-024-details.jpg)
- [LIST-025 enlarged source/corrected/q92/q95 contours and shadows](LIST-025-details.jpg)
- [LIST-026 enlarged source/corrected/q92/q95 contours and shadows](LIST-026-details.jpg)

## Validation

- Unit/integration: 260/260 tests in38 files PASS (`tests.txt`).
- TypeScript and ESLint PASS (`typecheck.txt`, `eslint.txt`).
- Image validation56 products/347 files and production frontend/server build PASS (`build.txt`).
- Scope/hash/decode/dimension checks PASS (`SCOPE_QA.json`): all51 other SKU and332 other creative files unchanged, including every PHOTO, secondary and texture.
- No CSS, design, catalog, business logic, dependencies, package manifest or lock changes.
- Reused outputs detected by `process-list-final-five.py`; no unnecessary repeat encoding.

Candidate encoding/size/quality/SSIM/source and output SHA-256 are preserved in `PROCESSING.json`. `INPUT_AUDIT.json` records five original primary/variant files. [Full changed-file list](CHANGED_FILES.md).

## Issues and stop

No blocking visual or technical defects detected. Cancelled Task14 PHOTO work was excluded through the fresh base rather than merged. Existing unrelated experimental work was not deleted. GitHub publication uses the connected authenticated GitHub API because shell push credentials are unavailable; remote SHA, parent and full tree must match the tested local tree before delivery. No PR, merge, deploy or dependency changes. STOP after remote saving and verification.
