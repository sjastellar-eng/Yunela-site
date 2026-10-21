# YUNELA private Render staging V6

Source: feat/partner-fulfillment-p0-v4-snapshot @ aac06321392e2b862aa3204c0f047d2a5d29ec83.
Deploy configuration branch: feat/render-private-staging-v6. No production or main merge.

## Create from Android

1. Connect the Render plugin to ChatGPT and select the intended Render workspace. GitHub access does not grant Render access. Alternatively open https://dashboard.render.com, select New > Blueprint, connect sjastellar-eng/Yunela-site, choose feat/render-private-staging-v6, and use render.yaml.
2. Review the paid web-service plan and 1 GB disk before creating. SQLite cannot persist on a free ephemeral filesystem. One instance only; region Frankfurt; no custom domain needed. No service has been created by merely committing this file.
3. Apply the Blueprint. Auto-deploy is off; initial creation still deploys. Keep NODE_ENV=staging. Build includes dev tools explicitly. Start command is node scripts/render-start.mjs, NOT the generic npm start. Render supplies PORT and RENDER_EXTERNAL_URL; the entrypoint uses that HTTPS origin automatically.
4. Wait for successful deploy and copy the actual HTTPS URL from Render. Do not assume the service name guarantees a particular URL. Check deployed commit matches this branch's reviewed HEAD.
5. In service > Environment, reveal YUNELA_STAGE_PASSWORD privately and open the URL in Android Chrome. Enter this password into «Пароль стенда». Keep it out of GitHub, screenshots, and messages. No password is hardcoded in the repository.
6. Search TEST-WEIGHT. Test prices for 20/25/50/100 grams: 170/200/350/600 UAH, synthetic only. Small packets may fail server order economics (CP target after test CAC); 100 g is the successful single-packet checkout path. This is deliberate; no universal minimum spend is imposed.
7. Use only fictional customer data. Test declined payment, retry success. Open «Оператор»; email operator@example.test; password is the separate YUNELA_OPERATOR_PASSWORD in Render Environment. Never reuse the staging password.
8. Prepare task > simulate send > acceptance > packing > confirm mass > carrier > delivered. Downloaded partner task is a simulation. For a separate paid order, cancel before handoff and simulate refund. No bank or partner receives anything.

## Persistence acceptance on Render (not yet executed)

Create a test order, record its ID and status. In Render restart the service without deleting its disk. Reopen the same Android browser and verify the same order/payment/status and operator access. Secret and passwords must remain stable. DB/WAL/SHM must all remain under /var/data. Never reset or delete the disk to troubleshoot.

Operator credentials are provisioned on first boot only; changing the environment password alone does not rotate an existing database identity. Rotate via a separately reviewed operation.

## Backup and restore

In Render Shell:

```bash
node scripts/sqlite-backup.mjs /var/data/backups/manual-UNIQUE.sqlite
```

Choose a new destination each time. Uses the SQLite online backup API, validates integrity, and restricts file mode. Do not copy a running database's main file alone: WAL may contain committed transactions. Backup contains private sessions/password hashes; do not commit or publicly share it.

For restore: stop the application, retain the old database and WAL/SHM as a private rollback set, copy the validated backup as /var/data/yunela.sqlite, remove stale WAL/SHM only while stopped, restore owner permissions, and restart with the same secrets. Validate integrity, all order/payment/workflow/refund records and buyer/operator sessions. Use an isolated copy for a rehearsal; do not overwrite a running production database. Render disk snapshots are supplementary, not this application-level backup verification.

Local browser-weight-e2e creates live synthetic orders, takes an online backup, compares every application table, restores to a different file and starts the server on that restored DB. This proves local SQLite recovery, not Render disk persistence or remote Android E2E.

## Boundaries

Only TEST-WEIGHT can be bought when YUNELA_SYNTHETIC_ONLY=1, even if an operator imports another approved synthetic record. Real catalogue candidates remain visible as requests and cannot be purchased. Legacy fixed SKU is disabled on this staging, but its isolated regression test remains available. All runtime payment/dispatch adapters remain offline. Public commercial launch and production mode are disallowed.

The HTTPS endpoint is internet reachable but the storefront/assets/APIs require the application staging password. noindex is an extra directive, not authentication. Render health check uses / (password page returns 200); /health remains protected.
