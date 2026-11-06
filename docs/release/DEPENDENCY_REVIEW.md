# Dependency review — 2026-10-29

Full npm audit: 9 affected package entries before, 5 after compatible updates. Package entries are not nine independent production exploits. Full raw results and exact installed paths are adjacent. Static staging serves dist only; none of these tooling servers runs there. A separate omit-dev audit was blocked by registry egress; no successful zero-result audit is claimed.

| Package | Before severity | Chain / scope | Outcome | Applicability / remaining fix |
|---|---|---|---|---|
| @vitest/mocker | moderate | vitest → @vitest/mocker; dev | OPEN | Remains; major toolchain upgrade required, no forced override. Dev/test server or worker execution; do not expose test servers or execute untrusted tests. Audit now recommends Vitest 5.0.5 (major). |
| brace-expansion | high | eslint → minimatch; typescript-eslint → minimatch → brace-expansion; dev | FIXED | Resolved by compatible update. 1.1.21 / 2.1.7; malicious glob brace recursion/CPU risk in developer tooling. |
| eslint-plugin-react-hooks | high | direct dev dependency; dev | FIXED | Resolved by compatible update. Lint toolchain; app does not use Zod to validate buyer data. Zod >=4.6.6 requires compatibility review of hooks plugin / validation-error major versions. |
| source-map-js | high | vite → postcss → source-map-js; production dependency classification, build-time execution | FIXED | Resolved by compatible update. 1.2.1 → 1.2.2 via PostCSS; malicious source-map parsing is build/tooling exposure. |
| tinypool | critical | vitest → tinypool; dev | OPEN | Remains; major toolchain upgrade required, no forced override. Dev/test server or worker execution; do not expose test servers or execute untrusted tests. Audit now recommends Vitest 5.0.5 (major). |
| vite | high | direct dependency; build/dev tool, no Vite server on static staging; production dependency classification, build-time execution | FIXED | Resolved by compatible update. 7.1.5 → 7.3.7. Dev server file disclosure/editor risks; no dev server on deployed static site. |
| vitest | critical | direct dev dependency; dev | OPEN | Remains; major toolchain upgrade required, no forced override. Dev/test server or worker execution; do not expose test servers or execute untrusted tests. Audit now recommends Vitest 5.0.5 (major). |
| zod | high | eslint-plugin-react-hooks → zod; dev | OPEN | Remains; major toolchain upgrade required, no forced override. Lint toolchain; app does not use Zod to validate buyer data. Zod >=4.6.6 requires compatibility review of hooks plugin / validation-error major versions. |
| zod-validation-error | high | eslint-plugin-react-hooks → zod-validation-error → zod; dev | OPEN | Remains; major toolchain upgrade required, no forced override. Lint toolchain; app does not use Zod to validate buyer data. Zod >=4.6.6 requires compatibility review of hooks plugin / validation-error major versions. |

Direct updates: vite 7.3.7, vitest 3.2.7, eslint-plugin-react-hooks 6.1.1. Compatible transitive refresh: brace-expansion, source-map-js. No npm audit fix --force or cross-major overrides. Remaining 5 package entries: 2 critical, 2 high, 1 moderate; all marked dev in lockfile. Owner: Developer, P1 before opening any nonisolated dev/test environment.
