# Private staging — existing Node/SQLite MVP

No real bank calls or partner dispatch; backend always uses offline test adapter. Never deploy with NODE_ENV=production. Staging access gate covers HTML, images, APIs and health. Password grants only site access; operator needs separate credentials. Cookie lasts 12h, HttpOnly, SameSite=Strict, Secure on HTTPS. Rate limits apply; database and authentication secret must survive restart. Staging is not a commercial launch.

Copy staging/environment.example to ignored .staging.env and replace every placeholder with separate random credentials (e.g. node:crypto randomBytes). Set an existing HTTPS origin. Do not send secret values in chat or commit them. Only synthetic customer information. Run:

```bash
docker compose -f staging/compose.yaml up --build -d
```

Use existing TLS reverse proxy with staging/nginx.conf.example; external HTTP is rejected at startup, localhost HTTP is allowed for local tests only. Container runs as node; SQLite data/WAL/SHM reside in named volume. Port binds localhost, root filesystem read-only, no outbound service integration. Never use `down -v` on retained data. Update through rebuild/restart preserving volume and secret. Login passwords are bootstrapped once; changing operator env does not rotate existing account credentials.

Backup via SQLite online backup API, not a live single-file copy (WAL may hold committed data):

```bash
docker compose -f staging/compose.yaml exec shop node -e "require('better-sqlite3')('/app/data/yunela.sqlite').backup('/app/data/backup.sqlite').then(()=>console.log('Backup complete'))"
```

Restrict backup access like the DB. For recovery stop shop, restore backup into named volume as yunela.sqlite with node ownership and no stale WAL/SHM, start with the same auth secret; validate PRAGMA integrity_check, order/payment/task counts and buyer session. Actual restart recovery is covered by browser-e2e. Docker image/Compose not executed where Docker daemon is unavailable; use supported host to validate container before publishing URL.

Local browser acceptance: npm ci; npm run build; npx playwright install chromium; npm run test:browser. Test creates private staging on 127.0.0.1:3092, random credentials, isolated file DB and fictional buyers; Chromium desktop/mobile paths, cookie protection and restart are exercised. Optional YUNELA_CHROMIUM_PATH selects an installed Chromium; YUNELA_E2E_OUTPUT chooses screenshot/results folder. Screenshots contain synthetic order identifiers, never credentials. 390x844 mobile is Chromium touch emulation, not a physical iOS/Safari test.

Public URL requires provisioned host with persistent writable disk, HTTPS endpoint and authorization to use it. Sites/Cloudflare Workers cannot run this native better-sqlite3/file backend as-is. No host, domain or live merchant is provisioned by these configuration files.
