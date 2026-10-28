# Micro-task 13 — LIST batch 04 staging deploy and QA

Date: 2026-10-29 Europe/Kyiv.

Published **3e87ade2d073332c6e181fae8d755f5d40a4780d** on the existing [staging](https://yunela-v92-demo.onrender.com).
Render service `srv-dbej0rjncjis73edf2h0`, deploy `dep-dbh75kei0phs73b1rqgg`: **live**, finished 2026-10-28 22:11:05 UTC.
[GitHub CI](https://github.com/sjastellar-eng/Yunela-site/actions/runs/40777832523): **success**.

## Scope and integration

Source HEAD matched the CEO-approved SHA. Its only parent is the previously live `f6ddcb149b7cc9b0b57f1d5a107b52f028f25020`. Only 15 primary/480/800 WebP files for LIST-017–021, their manifest SHA fields, and batch processing/evidence/handoff files differ. No unrelated commits included.

The existing Render-linked `feat/creative-gallery-v9-2` branch was fast-forwarded with `expected_sha=f6ddcb1…` and `force=false`, using the authenticated GitHub connector after shell `git push` failed for missing credentials. `git ls-remote` independently confirmed the full remote SHA. No merge to main; main remained `1ab4a9bd56fc441bc30d52dfffda4c924a51905d`. Auto-deploy remained off; the manual Render deploy built the approved SHA. Existing static hosting was reused; no resources, plans, orders or payment flows were enabled.

## Validation

- 260 tests / 38 files PASS; TypeScript, ESLint, image validation and production frontend/server build PASS.
- GitHub CI independently passed install, typecheck, lint, tests and production build on the published SHA.
- Render validator: 56 products, 347 master/responsive files PASS; static production build PASS.
- Source full BEFORE/AFTER, five enlarged detail panels and responsive detail panel reviewed before publishing: no conspicuous new halos, contour damage, colour shifts, lost contact shadows or scale changes.
- Live desktop 1440x1000 and mobile viewport 390x844, DPR1: five catalog cards, five product pages, and all 13 gallery selections at each viewport PASS. Primary cache revisions match the approved manifest. All secondary/texture URLs and display rectangles match before deployment.
- 0 page errors, console errors, failed requests, HTTP errors, API requests or horizontal overflow in these scenarios. No missing image fallback appeared.
- Before and after publication, 155 public image files for the previous 19 processed SKU and current five SKU were downloaded, decoded and SHA-256 verified. Previous SKU: LIST-001–016 and PHOTO-001/008/010. All 332 other creative files, all 51 other SKU and all non-hash manifest data unchanged.

## Evidence

[Desktop BEFORE / AFTER — all five SKU](evidence/1440-BEFORE_AFTER.jpg)

[Mobile BEFORE / AFTER — all five SKU](evidence/390-BEFORE_AFTER.jpg)

`evidence/{1440,390}-LIST-017…021.jpg` are individual live primary-gallery viewport screenshots, exported to JPEG at original dimensions. Contact sheets resize desktop screenshots to 720px each; mobile screenshots retain 390px width. Source comparison and enlarged details remain at [`../list-background-batch-04/`](../list-background-batch-04/).

`before/browser-results.json` and `after/browser-results.json` record gallery selections, currentSrc/revisions, decoded dimensions, display rectangles and errors. `scope-before.json` / `scope-after.json` contain every checked public image path and hash. `SUMMARY.json`, `ci-run.json`, `ci-jobs.json`, `render-deploy.json`, `render-build.log`, `ci-job.log` and local validation logs provide technical evidence. Reproducible QA scripts are included. This evidence branch adds only QA files; the live staging SHA remains the approved source commit.

## Issues and limits

No blocking visual or browser defects found. Visual review is observational and does not claim lossless pixel identity.

Render npm audit reports **9 existing dependency vulnerabilities (1 moderate, 6 high, 2 critical)**. Dependency manifests/lock are unchanged from previous staging; fixes were outside the authorized image-only scope.

Local setup issues were resolved without project changes: native header extraction ownership error via local headers; full Chrome process-singleton socket restriction via official Chrome Headless Shell. Shell git lacked credentials; authenticated GitHub ref update was used and remote state independently verified.

STOP after Micro-task 13. No further SKU or main integration performed.
