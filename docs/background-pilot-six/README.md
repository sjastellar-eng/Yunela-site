# Six-SKU background pilot — CEO review

Date: 2026-10-26 (Europe/Kyiv)
Branch: fix/background-pilot-six
Base: 3d514d24ab8b9249b8d4e6960591026d3699118d (Draft PR #28)

## Scope

LIST-006, LIST-014, LIST-016, PHOTO-001, PHOTO-008, PHOTO-010 only.
Six primary masters and their existing 480/800 WebP exports (18 files).
Other 50 SKU and every secondary/texture image remain identical to base.

The prior unpublished 741deae6d0da6dc7b1a279a077944e9670f6d749 changes
217 files: 210 images (70 masters/adaptives), two manifests, two docs, two
scripts and global gallery CSS. It is outside this pilot and was not merged,
cherry-picked, reset or overwritten. It remains in its original worktree.

## Implementation

Reference: #FAF9F5 / RGB 250,249,245, existing LIST-container background.
Offline spatial backdrop correction, no generated subjects or global colour
grade. Protected dark foreground pixels (<180 maximum RGB channel) remain
pixel-identical; central wrapper paper/artwork stays pixel-identical. Source
contact-shadow residuals retained with continuous tonal transitions. Outer
empty margin feathered to exact reference; source size, object placement,
proportions, framing and gallery assignment retained.

Lossless WebP exports avoid additional compression changes to protected pixels.
Every export decoded and compared with its processed buffer; all four extreme
corner pixels equal 250,249,245. Source hashes, export hashes, dimensions and
sizes are recorded in PROCESSING.json. Both existing manifests updated only
for the six primary hashes; cache revision continues to use those hashes.

CSS is applied only to the six primary images, through a scoped component
class. LIST cover and PHOTO contain rules remain unchanged, including the
existing thumbnail/gallery cascade. Other product containers are unchanged.

## Before / after

BEFORE_AFTER.png: each of three columns is a BEFORE/AFTER pair. Top two rows:
LIST full images and identical-coordinate enlarged contour/shadow crops.
Bottom two rows: PHOTO full images and identical-coordinate wrapper-edge crops.

Visual review: earlier hard-cutoff shadow artefacts were corrected before this
checkpoint. Final comparison shows continuous contact shadows and preserved
leaf contours, packaging, visible print and logos at the reviewed scales.
This is local image review, not a public browser/staging acceptance claim.

## Validation

- 260 tests / 38 files PASS; typecheck and lint PASS.
- Native image validator: 56 primary, zero pending, 347 files PASS.
- Frontend and server production build PASS.
- Scope comparison against base: exactly six manifest records and 18 image files
  changed; all other SKU records and all non-primary gallery assets identical.
- Export decode, SHA-256, dimensions, exact corner RGB and foreground protection
  assertions PASS for all 18 files.

## Limits and release gate

18 lossless exports total 9,135,798 bytes, approximately three times their
previous compressed size. This preserves pixels but increases transfer size;
performance optimisation needs separate visual review before broader rollout.
No local responsive browser acceptance was performed in this micro-task.
No PR created/updated, no merge and no public deployment. Staging remains base.
CEO review is required before deployment or extending to other 50 SKU.
