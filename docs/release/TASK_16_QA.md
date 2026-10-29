# Task 16 — server staging and full TEST order

Date: **2026-10-30 Europe/Kyiv**. Verdict: **BLOCKED — criterion not met**. No server staging was created; no published browser order/TEST-ID exists. Local checks are preparation only.

## Repository and infrastructure baseline

Read repository README, Task15 QA, LAUNCH_BLOCKERS, HANDOFF, runtime, staging gate, SQLite client, Render start/backup scripts and prior V6 deployment instructions. No AGENTS.md found. Fresh isolated worktree `fix/task-16-server-staging` from remote staging HEAD **bb1734e26ee007e3870fc734fb2a68752d5e0644**, tree c2a0b8dfac3ec0ed3acacc9ba7563feb4a610d4a. Existing Task15 local checkout/commits were preserved; no unrelated changes imported.

Render list_services(includePreviews=true) in previously confirmed My Workspace found only five YUNELA static sites, no suitable existing YUNELA server/disk. Other listed web services belong to SellCase and were not repurposed. Existing static service srv-dbej0rjncjis73edf2h0 remains LIVE **592756bd1c9bb124574388bb1d9c2bcc14004e73**, deploy dep-dbhpqmg8v5cc73944i4g, at https://yunela-v92-demo.onrender.com/. No new deploy, plan change, paid resource, supplier action or payment occurred.

## Prepared work

- Separate `staging/render-server.yaml`: one native Node24 server + existing frontend,0.5c-512mb,1GB disk at/var/data, HTTPS origin from Render, explicit dynamic frontend, generated independent secrets, staging gate and synthetic-only offline fixture.
- Hardened scripts/render-start.mjs and new tested preflight: refuse absent mount, wrong DB path, static frontend, unsafe binding, missing test gates, weak/reused secrets or noncanonical HTTPS origin **before opening SQLite**. Restrictive umask for new runtime files.
- Readonly scripts/staging-storage-evidence.mjs: verify existing TEST order + items/commercial snapshot hash/integrity/count/status without dumping personal data. Does not create missing DB/order or alter records.
- Complete deployment, backup, restart and redeploy acceptance runbook in staging/TASK_16_RUNBOOK.md. Root static render.yaml, images/catalog, visual styles and business policies unchanged.

## Results

| Required result | Expected | Actual | Status |
|---|---|---|---|
| Existing suitable server/disk | Reuse approved compatible YUNELA resource | None in confirmed workspace; five static YUNELA sites only | BLOCKED |
| Server + frontend published | Protected HTTPS dynamic app, same-process API | Configuration prepared, not applied because paid resource creation forbidden | BLOCKED |
| Persistent SQLite | Disk under/var/data, survives remote lifecycle | Mount guard/config and local file rehearsal pass; no Render disk exists | BLOCKED remotely |
| Safe actions | No bank/supplier/carrier side effects | Existing TestMonoAdapter + dispatchEnabled=false + synthetic-only entrypoint retained | PASS source/local |
| Staging login and operator separation | Secret-only environment, cookie plus independent operator bearer | Existing gate/auth tests and new preflight tests pass; no exposed server to inspect | PASS local / BLOCKED remote |
| Full browser order | Catalog/card/weight/cart/quote/TEST checkout/operator/export | No published server URL or browser-created TEST-ID | BLOCKED |
| Server amount and duplicate protection | Ignore client amount; no duplicate order/reservation | Existing Task15/weighted/concurrency regression suite passes | PASS local / BLOCKED remote |
| Foreign order/operator denial | 403/401 appropriately | Existing HTTP/access tests pass | PASS local / BLOCKED remote |
| Readable API errors | Client preserves validation and friendly 5xx/network message | Existing storeRequest tests pass | PASS unit / BLOCKED browser |
| Readonly retention evidence utility | Correct actual schema, stable hash after reopen, no PII output | Task16 test creates only a local TEST order, closes/reopens SQLite, reruns migrations, gets same evidence; refuses non-TEST recipient | PASS local |
| Service restart retention | Same actual TEST-ID/data after Render restart | No server service; not executed | BLOCKED |
| Redeploy retention | Same TEST-ID/data after distinct Render deploy | No server service; not executed | BLOCKED |
| Exact390px and1440px | Browser order at those real widths + screenshots/network/page errors | Not executed against server; no substitute-width claim | BLOCKED |
| Blueprint schema | Valid current official JSON schema | Draft2020-12 check PASS | PASS |
| Render CLI semantic/conflict validation | Authenticated platform-aware check | CLI2.33.0 returns `run render login`; connector auth not exposed to shell | BLOCKED |
| Full regression/build | Tests/typecheck/lint/images/client+server | **268 tests /42 files PASS**; TS/lint/images56/347 and VITE_STATIC_DEMO=0 production build PASS | PASS |

Evidence: [tests](evidence/task16/tests.txt), [TypeScript](evidence/task16/typecheck.txt), [ESLint](evidence/task16/eslint.txt), [build/image validation](evidence/task16/build.txt), [schema](evidence/task16/blueprint-schema.json), [CLI result](evidence/task16/blueprint-cli.txt), [infrastructure](evidence/task16/infrastructure.json), [pricing](evidence/task16/pricing.json).

No new screenshots: there is no published Task16 server to screenshot. Prior Task15 screenshots are not reused as Task16 acceptance. Local regression tests and mountinfo fixtures do not establish remote disk durability.

## Cost decision needed

Live official Render pricing fetched/read on2026-10-30: web0.5c-512mb USD7/month;1GB disk USD0.25/month; **USD7.25/month incremental base**, excluding taxes/usage overages and existing workspace subscription. No workspace plan upgrade proposed. https://render.com/pricing; paid-disk requirement and service-scoped/runtime-only mount rules verified at https://render.com/docs/disks. Current Blueprint/schema/default-env/secrets documentation also retrieved and read.

CEO must authorize this separate paid service+disk or identify an existing suitable YUNELA server with persistent storage. After that: validate/apply the prepared Blueprint, record actual URL/SHA, execute published browser order and both remote retention checks. COD advance remains unselected; all sales remain disabled.

Prepared source commit: the commit introducing this report on fix/task-16-server-staging. Remote saved SHA will be supplied in the final handoff; **it is not a deployed server commit**.
