# Developer handoff — Micro-task 07A

Date: 2026-10-26 (Europe/Kyiv)
Branch: fix/list-background-batch-01
HEAD before: 87955d66b4966cff242e9123ade376a98f58d186
HEAD after: recovery commit containing this checkpoint (git rev-parse HEAD).

Lost f87aab9 unavailable in GitHub/local reflog/worktrees/artifacts. Reproduced
ONLY LIST-001..005 from immutable staging using unchanged approved pilot
recolour(). q95 LIST-001, q92 LIST-002..005, method6; master/480/800.
15 exports total 1869850 bytes, same as prior approved total and per-SKU totals.
Old per-file hashes unavailable: byte identity NOT claimed. New hashes recorded.

Two manifests: only 15 relevant hashes changed; all other data/order identical.
Other 51 SKU including prior six pilot, CSS/UI/catalog/YUNA unchanged.
260 tests /38 files PASS; ESLint PASS; image validator and full production
frontend/server TypeScript build PASS. Crop visual inspection PASS; prior
approved low-resolution montage compared; no new browser acceptance claimed.

Report/evidence: docs/list-batch-01-recovery/README.md, PROCESSING.json,
QA_RESULTS.json and BEFORE_AFTER.jpg. Script recover-list-batch-01.py.
This recovery will be persisted to dedicated GitHub branch, not Render branch.
Staging remains 87955d6. No merge or deploy. Broad 741deae worktree preserved.
Next step: STOP; CEO review and separate authorization for staging publication.
