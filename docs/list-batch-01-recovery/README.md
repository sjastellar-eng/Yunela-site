# Micro-task 07A — LIST batch 01 recovery

Date: 2026-10-26 (Europe/Kyiv). Branch: fix/list-background-batch-01.
Base: 87955d66b4966cff242e9123ade376a98f58d186. Staging unchanged.

## Recovery evidence

Lost f87aab9c3c1c8c420d5c9669eaaeae7a7c3eee08 unavailable locally
(cat-file, reflog, fsck and worktree inventory) and GitHub fetch_commit returned
422 No commit found. Remote branch absent; no bundles, previous worktree,
processed exports or manifests found in accessible workspace/temp artifacts.
PR28 and the six-SKU remote pilot branch remain at 87955d6. Existing broad
unpublished 741deae worktree preserved without changes.

## Reproduction

New isolated worktree from staging 87955d6. Unmodified recolour() from approved
scripts/background-pilot-six.py. Fresh original masters read from immutable
staging commit. Spatial background correction #FAF9F5; original contact shadow
residuals retained; contrasted and dark pixels protected before encoding.
No generation, global grade, resizing of masters, new composition or CSS edits.
Existing 480/800 versions regenerated via approved Lanczos from corrected master.
LIST-001 q95, LIST-002..005 q92; WebP method6. SourceSku/gallery order preserved.
Pale foreground may receive small correction; not every light pixel is identical.

| SKU | Total bytes (master + 480 + 800) |
|---|---:|
| LIST-001 | 345380 |
| LIST-002 | 342720 |
| LIST-003 | 416946 |
| LIST-004 | 370232 |
| LIST-005 | 394572 |
| Total | 1869850 |

Total and all five SKU totals match prior reported optimized sizes exactly.
This does NOT prove byte identity to the lost commit: its per-file hashes
are unavailable. New SHA-256 values and tool versions are in PROCESSING.json.
Decoded backdrop corners within 2 levels of target 250/249/245 (typically
251/249/245; q92 may give 249/250/245 at one corner).

## Visual and engineering checks

BEFORE_AFTER.jpg: all five full images plus same-coordinate leaf and shadow
crops. No conspicuous new halos, stretched subjects or shadow artifacts seen.
Compared against saved prior approved RESPONSIVE_Q98_VS_SELECTED.png from
Library libfile_2c4e623d9ef48191aeb799fb72df9b36 (485x1536 preview).
Visual correspondence found; downscaled montage cannot prove pixel identity.
Prior saved README-5(2).md describes micro-task05 q98, despite its newer name;
it is not treated as the micro-task06 processing manifest.

260 tests / 38 files PASS; ESLint PASS; image validator PASS (56 primary,
347 assets); full production frontend/server build and TypeScript PASS.
All 15 exports decode with correct original/master/480/800 dimensions.
Hashes verified; non-hash manifest fields unchanged. Other 51 SKU, previous
six-SKU pilot, all secondary/texture assets and source/UI/CSS unchanged.

## Changed files

15 public/creative/LIST-001..005 master and primary-480/800 WebP;
content/creative-gallery.v1.json; content/creative-images.v1.json;
scripts/recover-list-batch-01.py; docs/DEVELOPER_HANDOFF_LATEST.md;
docs/list-batch-01-recovery/{BEFORE_AFTER.jpg,PROCESSING.json,QA_RESULTS.json,README.md}.

Persistence uses a dedicated GitHub branch; no change to Render-tracked branch,
PR28, main, commerce or service configuration. No merge/deploy.
Next step: STOP for CEO review before staging publication.
