# V6 staging preparation validation — 2026-10-21

Status: READY FOR RENDER CONNECTION; NOT DEPLOYED. No HTTPS URL or Render service ID exists from this task.

## Verified baseline

GitHub source branch feat/partner-fulfillment-p0-v4-snapshot was read with git ls-remote at aac06321392e2b862aa3204c0f047d2a5d29ec83. Development worktree starts at that exact commit. Changes are isolated in feat/render-private-staging-v6; source snapshot and main are unchanged.

## Executed locally

| Check | Result |
| --- | --- |
| npm ci | Initial failure: Node header archive extraction fchown EINVAL in workspace. Repeated npm ci with matching locally extracted Node 24.19.0 headers: exit 0, 244 packages installed; no dependency version changes |
| npm run typecheck | Exit 0 |
| npm run lint | Exit 0, including final browser/backup scripts |
| npm test | Exit 0: 221 tests in 31 files |
| npm run build | Exit 0: browser and server bundles |
| npm run test:browser | Exit 0: 8 result groups, desktop/mobile and 360/768px, auth/CSRF checks and SQLite restart persistence |
| npm run test:browser:weight | Exit 0: desktop 1440x1000 and mobile 390x844, synthetic-only catalogue, 20/25/50/100g prices, invalid mass, CP failure, server quote, checkout, decline/retry, payment persistence, operator/ACK/packing/carrier/tracking/delivery, paid cancel and simulated refund |
| SQLite online backup/restore | PASS: all 39 application tables equal, 4 orders preserved; server starts against a restored copy; integrity_check=ok |
| render.yaml | Validated against https://render.com/schema/render.yaml.json (JSON Schema draft 2020-12) |
| Secret pattern scan | No private-key, GitHub token or AWS access-key patterns in tracked/planned files. Examples in README/tests are explicit synthetic credentials. No live credentials supplied or committed. This is a pattern scan, not proof against every possible secret format |
| git diff --check | Exit 0 |

Browser: Playwright 1.62.1 controlling Chromium Headless Shell 134.0.6998.35 downloaded from Google's official Chrome-for-Testing storage. Default Playwright Chromium CDN download returned unavailable/truncated archives in this environment. Mobile result is Chromium emulation, not a physical Android or remote Render test. Commands accept YUNELA_CHROMIUM_PATH for reproducibility.

Browser run creates only fictional buyer data and random ephemeral test credentials, writes logs/screenshots under ignored artifacts/v6, and uses isolated temporary SQLite files. Legacy browser regression explicitly enables TEST-ONLY only in its own process/database. The proposed Render staging does not enable that legacy SKU.

## Changes

- Native Node Blueprint: 1 instance, explicit persistent disk /var/data, manual deploys, separate generated secrets, HTTPS origin supplied by Render.
- Fail-closed Render start wrapper requiring staging gate, synthetic-only flag, correct DB path and disabled legacy fixture.
- Server synthetic-only policy prevents purchasing any SKU other than TEST-WEIGHT even after an operator imports another synthetic approved SKU; covered by regression test.
- Protected catalogue makes non-test offers requests. No real bank or partner integration added.
- SQLite online backup helper with integrity check, destination overwrite rejection and private backup file permissions.
- Expanded browser acceptance for weights, tracking, cancel/refund and complete local backup/restore.
- Android/Render setup, access and recovery instructions: staging/RENDER_V6.md.

## Deployment blockers and next actions

1. Render plugin was discovered but is not installed/connected. Connect Render in ChatGPT, authorize the intended workspace, then continue deployment. Do not send API keys, passwords or tokens in chat.
2. The persistent disk requires a paid Render web service. Blueprint plan/disk must be reviewed in the actual workspace. No billable service or disk was created here.
3. After connection: create/sync Blueprint from feat/render-private-staging-v6, verify deployed HEAD, HTTPS/password gate/noindex and only TEST-WEIGHT purchasable. Record actual service ID and URL. Secrets remain in Render Environment; operator and staging passwords are distinct.
4. Run remote acceptance, restart service preserving disk, and rehearse backup/restore on an isolated copy. Local recovery PASS does not establish Render persistence.
5. Inspect GitHub Actions on the Draft PR. Remote CI status is reported separately; local successful commands are not a remote CI PASS.

No merge, production deployment, live payment, external partner dispatch or real customer data operations performed.
