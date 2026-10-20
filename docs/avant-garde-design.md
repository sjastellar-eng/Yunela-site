# YUNELA — Avant-Garde Tea Editorial V1

Base: `feat/storefront-browser-staging`, `c3036cd7a56257040d4b40ebfb05dbbb61426337`.
Branch: `feat/avant-garde-tea-editorial-v1`.

Frontend design: forest/charcoal (#122c23 / #121b17), vermilion (#c83d1c), paper (#f5f2e9), amber hero highlight. System Georgia / Times New Roman editorial serif and Arial / Helvetica UI sans; Ukrainian Cyrillic, no remote font requests or bundled font licensing claims. Existing text wordmark preserved as fallback; final approved vector logo remains missing.

Homepage: generated editorial hero with clear catalog CTA, mobile menu, visible cart count, category navigation, search + availability filter, responsive cards, brand story, Tea Finder direction chooser, special-order explanation, buyer links, and understated operator access in footer.

Product, cart, checkout, order status and operator forms share tokens, focus states and responsive layout. Backend, SQLite, auth, staging gate, offline payment adapter, operator actions and partner simulation unchanged. Race-test workers load bundles compiled once from the same production database/repository/service sources by existing Vite (`scripts/build-test-workers.mjs`), instead of starting a Vite dev server in every iteration. Native SQLite stays external. No new dependencies or framework, no mocks, and no changes to the assertions, 20-iteration stress loops or original timeouts. `npm test` prepares these ignored worker artifacts. Main Vite test mode disables unnecessary dependency discovery/HMR. No merges, pushes, external deployment, real payments or partner dispatch.

Catalog integrity: supplier photos retained and compressed into WebP. Original JPEGs stay in repository. Search includes displayed name, supplier name, family and legacy SKU. PHOTO identifiers are still searchable internally but no longer appear in customer headings or image alt text. No invented tasting notes, prices, stock, reviews or bestsellers. Unknown tea families are not silently assigned to puer. Category emptiness is explicitly supported. Candidate status and confirmation remain visible. Partner catalog data is provisional; only test fixture supports browser purchases until real offers are confirmed.

Tea Finder is a lightweight category direction chooser, not the domain recommendation engine. Special-order request submission is not connected and its screen explicitly states this. Discovery Box and profile remain in existing lab route, not represented as new integrated commerce features.

Editorial image: `public/editorial/tea-hero.webp`, generated through built-in Imagegen, not an SKU product representation. Prompt: cinematic macro still life of dark textured ceramic bowl with amber tea being poured, black rock/moss, deep forest/charcoal, warm sidelight; wide layout with dark left negative space, bowl right; no text, logos, packaging, dragons or people. Category leaf illustrations use existing lucide-react icons; references are inspiration only and none are reproduced as storefront assets.

Browser routes are existing in-memory views at `/`: catalog/home, product, cart, checkout, order status, operator; new about/finder/special views. Lab remains `/#/lab`. Viewport acceptance: 1440x1000, 390x844, 360x1000, 768x1000 (Chromium touch emulation where stated, not physical devices or Safari).

Page navigation scrolls immediately to avoid mid-scroll compositor frames and to keep cart/checkout headings visible. Motion: subtle photo zoom and category lift on hover; reduced-motion override removes transitions/transforms. Images are lazy loaded except hero; hero is about 216 KiB. Mobile compact header, toggled menu, two-column grid, one-column detail/forms, 44px controls, skip link, visible keyboard focus.

## Reproduce

```bash
npm ci
npm run typecheck
npm run lint
npm test -- --maxWorkers=1
npm run build
YUNELA_CHROMIUM_PATH=/path/to/chromium-or-headless-shell npm run test:browser
```

On hosts with Node native-header extraction ownership errors, use installed matching Node headers for better-sqlite3 build. This workspace used Node 24.19.0 headers with `npm rebuild better-sqlite3 --nodedir=...`; no package version change.

No public staging URL provisioned. Existing protected staging Compose and persistence configuration remains intact; host/TLS provisioning is separate.

## Screenshot map

All after screenshots are real Chromium renders of `/` with the named in-memory view (no fabricated deep links).

| File pattern | View | Viewport |
| --- | --- | --- |
| desktop-home / category / catalog / products | Catalog and homepage | 1440 × 1000 |
| mobile-home / category / catalog / products | Catalog and homepage | 390 × 844, touch emulation |
| desktop-photo-product / product / cart / checkout / status | Product / cart / checkout / buyer status | 1440 × 1000, full-page capture |
| mobile-photo-product / product / cart / checkout / status | Product / cart / checkout / buyer status | 390 × 844, full-page capture |
| width-360-home | Homepage | 360 × 1000 |
| width-768-home | Homepage | 768 × 1000 |

Before images are supplied by the user handoff (1536 × 1067 and 710 × 1536 image pixels); original viewport/DPR and exact capture SHA were not specified. They are not claimed as freshly captured at the base SHA.
