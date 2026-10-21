# V8 validation

Application commit: e402fa528b2d7db799175f23db947341796cd752.
Preview: https://yunela-catalog-v2-demo.onrender.com
Draft PR: https://github.com/sjastellar-eng/Yunela-site/pull/24

- npm ci: installed 244 packages (local --ignore-scripts; CI normal install passed).
- typecheck, lint: passed.
- npm test: 33 test files, 233 tests passed, including 12 new V2 checks.
- full npm build (frontend + server): exit 0.
- static build: passed.
- local browser 390x844 and 1440x1000: passed.
- Render browser 390x844 and 1440x1000: passed. 56 records, disabled purchase, SKU search, details, brewing, corrected taxonomy, no horizontal overflow, JS errors or API requests.
- HTTPS: index, demo-catalog.json and robots.txt HTTP 200; 56 V2 records, prices and stock null, confirmed false.
- Render deployment dep-dbccitks728c73enf5hg: LIVE at application commit above.
- GitHub Actions validation job 119275534005, run 39615568848: success for application commit; install, typecheck, lint, tests and full build passed.
- Existing https://yunela-demo.onrender.com: HTTP 200, still original catalog without V2. Service unchanged.
- Actual-source checks reject duplicate/missing identity, text mismatch, numerical sensory injection, sales approval change and invalid duplicate mapping. Repeat import unchanged.
- XLSX/CSV: all 56 names/categories/short descriptions/canonical IDs match.

A subsequent test-only fix waits for the catalog request to complete before asserting the card count on a remote network. It changes no deployed application files. This report records executed checks, not commercial launch approval.
