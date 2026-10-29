# Task 16 — server staging deployment and acceptance

Prepared 2026-10-30 Europe/Kyiv. **NOT DEPLOYED. Paid infrastructure NOT APPROVED.**

## Resource proposal for CEO

Use the existing backend unchanged in architecture: native Node24 + better-sqlite3, frontend served by the same process, one instance, dedicated persistent disk. Separate service name `yunela-server-staging`; actual URL must be copied from Render after creation, not guessed.

| Resource | Configuration | Full-month incremental base |
|---|---|---:|
| Render web service | 0.5c-512mb, 512MB, Frankfurt, one instance | USD7.00 |
| Persistent disk | 1GB mounted at /var/data | USD0.25 |
| Total | No workspace plan upgrade proposed | **USD7.25/month** |

Checked against live official https://render.com/pricing on2026-10-30. Excludes taxes, usage overages and any existing workspace subscription. Compute is usage prorated; USD7.25 is a full-month base estimate, not an all-inclusive charge cap. Disk billed on provisioned capacity. Official constraints: https://render.com/docs/disks. Disks require paid web/private/worker services; a free ephemeral web service does not satisfy this task.

Current My Workspace has five YUNELA static sites and no suitable YUNELA server with disk. SellCase services are another project and were not repurposed. The static demo remains https://yunela-v92-demo.onrender.com/, LIVE592756bd1c9bb124574388bb1d9c2bcc14004e73. No resource or tariff was changed.

## Reviewed source and deployment configuration

- Repository: sjastellar-eng/Yunela-site; branch `fix/task-16-server-staging`.
- Blueprint file: `staging/render-server.yaml`. Root `render.yaml` is intentionally unchanged.
- Config creates a **separate paid service**. Do not apply before explicit CEO spending approval.
- `npm ci --include=dev && npm run build` compiles native SQLite and builds client + server. Do not add `--ignore-scripts` to this server install.
- `VITE_STATIC_DEMO=0` is explicit for build/runtime. No public static mode on the server deployment.
- Start: `node scripts/render-start.mjs`. Do not substitute generic npm start, which bypasses deployment preflight.
- `/var/data/yunela.sqlite` and SQLite WAL/SHM reside on the disk. Runtime migrations run after mount validation; do not move migrations to build/pre-deploy, where Render disk is unavailable.
- Preflight requires actual `/var/data` mount, all staging/synthetic/weight-fixture gates, binding0.0.0.0, distinct strong environment secrets and canonical HTTPS origin. It fails before opening SQLite if the mount is absent. Mount detection is a startup safeguard, not proof of retention across remote deploys.
- Independent generated secrets: YUNELA_AUTH_SECRET, YUNELA_STAGE_PASSWORD, YUNELA_OPERATOR_PASSWORD. Synthetic operator identity: operator@example.test. No secret is in Git or this document.
- Origin is derived from documented RENDER_EXTERNAL_URL unless an explicit canonical HTTPS origin is supplied. PORT is provided by Render. No custom domain required.
- HTTP health path `/` returns only the password gate before authentication. Assets/API/`/health` remain protected. Operator bearer authentication is separate from the staging cookie. noindex/X-Robots-Tag is not authentication.
- Runtime payment adapter is TestMonoAdapter; partner processing is local simulation/export. No bank, Telegram sender, carrier integration or commercial SKU is enabled. TEST-WEIGHT is the only purchasable synthetic fixture. No COD/deposit amount is selected.

## Steps after CEO approves spending

1. In confirmed Render **My Workspace** (tea-d3r4s556ubrc738e1j5g), create a Blueprint from this repository/branch; explicitly select path `staging/render-server.yaml`. Review service name, paid plan,1GB disk and auto-deploy off before applying. No existing static site should be managed or replaced by this file.
2. Render generates three independent secrets once. Keep them stable across restart/redeploy. Access/reveal them privately in Render Environment; never paste credentials into reports, screenshots or Git. Operator credentials are provisioned only on first boot; changing an environment password does not rotate an existing identity.
3. Wait for Render LIVE, inspect the actual deploy commit and disk configuration, and copy the actual HTTPS URL to HANDOFF as primary server QA address. Keep the static demo accessible.
4. Open the server URL and verify anonymous access sees only the staging login. Anonymous catalog/assets/health must be401. Wrong password and cross-origin login must fail. Enter the staging password privately.
5. On **actual viewport390×844**, search TEST-WEIGHT; open card. Reject21g, calculate100g=600UAH in the explicit synthetic policy; add to cart, change weight, remove/re-add and verify empty cart. This curve/20g/5g is a TEST fixture, not commercial policy.
6. Submit with recipient `TEST TASK16 BUYER`, synthetic phone+380000000000, city TEST CITY, address TEST ONLY, postal00000; confirm test acknowledgement. Record actual returned order ID as TEST-ID. Do not invent a success ID before this happens.
7. Repeat the submit action to check one order/one reservation. Confirm server total remains60000 minor units despite a client amount=1 in a controlled request. Validate another buyer gets403 for this order and buyer/anonymous cannot call operator APIs. Inject API failure through test tooling only; verify readable error and safe retry.
8. Use the offline payment success button if payment release is required for export. This adapter never contacts a bank. Log in as operator with the separate operator secret; verify TEST-ID, weight, total, recipient and prepared TEST-only JSON/Telegram draft. Do not send it. Missing carrier/contact/date and absent supplier-settlement gate remain operational launch blockers.
9. Repeat full browser acceptance at **actual1440×1000**. Capture login/card/cart/checkout/success/operator/export; record real viewport, page errors and failed network requests. Never substitute a cropped image or different viewport. If browser resize/fault injection is unavailable, mark affected checks BLOCKED.

## Prove persistence without deleting data

Perform the following only after the TEST order exists and no order status edits are in progress:

```bash
node scripts/staging-storage-evidence.mjs ACTUAL_TEST_ORDER_ID
```

Run inside the existing service's Shell, where YUNELA_DB_FILE is already configured. Do not run as a Render one-off job: it cannot mount the service disk. The command uses readonly/fileMustExist SQLite, checks integrity, requires TEST/SYNTHETIC recipient and prints a hash/count/status without recipient/address/phone. It never creates an order or repairs/replaces the DB.

1. Save initial TEST-ID, orderSnapshotSha256, payment/task status and count in private QA evidence. Run an online backup to a new unique destination using the existing utility if needed:

```bash
node scripts/sqlite-backup.mjs /var/data/backups/task16-UNIQUE.sqlite
```

2. Restart the **same** server service without deleting/recreating the disk or changing secrets. Verify same TEST-ID via buyer and operator browsers and run the readonly command again. Hash/status must remain unchanged; count must not decrease. Existing sessions should still work.
3. Trigger one intentional redeploy of the reviewed server commit. A disk-backed service briefly stops during deployment. After LIVE, repeat browser and readonly checks a third time. Record deploy IDs and published SHA. A local process restart is not proof of Render retention.
4. Do not reset the DB, clear tables, delete WAL/SHM or restore a disk snapshot for this test. Backup files contain private sessions/password hashes and must never enter public GitHub evidence.

## Validation performed versus still blocked

268 local automated tests, TypeScript, ESLint,56-gallery/347-file image validator and production server/client build pass. Blueprint validates against Render's current Draft2020-12 JSON schema. Render CLI2.33.0 semantic validation is BLOCKED because CLI has no login; connector authentication is not copied into shell credentials. JSON schema validation is not remote conflict/plan validation.

Published server URL, browser-created TEST-ID, remote restart/redeploy retention, exact390/1440px screenshots and browser/network error checks remain **BLOCKED by unapproved infrastructure**, with viewport tooling separately requiring confirmation during actual acceptance. No Task16 screenshot or live order is fabricated. See docs/release/TASK_16_QA.md.
