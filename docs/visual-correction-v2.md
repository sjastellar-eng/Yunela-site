# YUNELA — CEO visual correction V2

Review candidate, not a complete-store redesign or approval of final art direction.

Branch: `feat/avant-garde-visual-correction-v2`. Base: V1 `0eb9f47781aa5e351a05aa4bd442fadafac2062d`, whose ancestor is the required staging base `c3036cd7a56257040d4b40ebfb05dbbb61426337`.

## Implemented scope

- Desktop/mobile hero: deep black, single isolated ceramic tea bowl, oversized uppercase Ukrainian headline, one vermilion CTA. Removed second CTA, star/stamp, decorative strip and long hero copy.
- Unbounded 800 display for hero/catalog, Manrope 800 category typography, Onest 400/600 UI/product titles. Actual browser comparison of all three display candidates included. Unbounded has the most distinctive wide shapes; Manrope keeps category scanning compact; Onest keeps long product names readable. Local WOFF2 assets, Ukrainian cmap verified including Є/І/Ї/Ґ, SIL OFL licenses included. No remote font requests.
- Category rows use large type, index, mood and direction arrow instead of leaf graphics and decorative colored tiles. Accessible labels and selection states.
- Catalog: clear neutral surface, two large leading cards then a three-column rhythm on desktop; one large leading card then two columns on mobile. Photographed offers sort first, remaining offers are retained. Search/category/availability filters and disabled purchasing constraints remain.
- Removed terminal periods from the new short campaign headings. Ordinary Ukrainian prose retains punctuation.
- Scoped CSS class applies only to homepage/catalog. Product detail, cart, checkout, order status and operator keep V1. Lower homepage story/discovery sections remain pending direction approval.

No backend/API/database/payment/checkout/operator logic changes. No merge, push or deployment. Editorial bowl image is not presented as a specific SKU. Actual supplier product photographs remain untouched.

The referenced Devialet attachment was not available among accessible uploads. The supplied written description guided this implementation; literal reference matching has not been verified.

## Validation actually run

- `npm run typecheck`: PASS.
- `npm run lint`: PASS (unused test global removed after the first lint run).
- `npm run build`: PASS (TypeScript, client and server build).
- `scripts/visual-v2.mjs`: PASS at 1440×1000, 390×844, 360×800, 768×1024. One hero CTA, images/fonts load, categories, 30 photographed offers found by name/SKU, empty search, unavailable purchasing disabled, test-cart quantity, checkout entry, no horizontal overflow, no JavaScript errors.
- Existing `npm run test:browser`: PASS, eight groups. Staging API/health denied anonymously; desktop/mobile purchase simulation and declined-payment retry; operator transition/export; session/order/payment persistence after server restart; CSRF and operator boundary checks; SQLite integrity; two delivered simulated orders.
- Chrome Headless Shell 134.0.6998.35, local protected staging with isolated SQLite and fake buyers. Physical phones/Safari not tested.
- Full unit suite not rerun for this visual-only correction. V1's 206/206 is historical, not claimed as a new V2 run.

Screenshots: `artifacts/visual-v2/` (12 viewport captures plus typography comparison). Separate regression results: `artifacts/browser-v2/results.json`. Typography comparison alone uses a browser context with CSP bypass to display an internal inline comparison fixture; real-store checks use normal CSP. Application security configuration is unchanged.

## Asset provenance

Built-in imagegen generated `public/editorial/tea-object-v2.webp` (about 56 KiB). Final prompt: one sculptural black ceramic bowl filled with luminous amber tea in a pure black studio void, low three-quarter angle, dramatic narrow rim light, raw microtexture, generous black upper area for live type, subtle steam; no pouring, splash, extra objects, leaves, moss, stones, scenery, decorative graphics, text, logos or Chinese motifs. Source PNG stays in the project session's generated_images directory; the production WebP is committed.

Font binaries downloaded from Google Fonts and licenses from the official google/fonts repository; converted locally to WOFF2. Onest 800 is retained for the reproducible typography comparison.

## Pending

CEO visual approval of this limited scope, actual Devialet attachment if literal comparison is required, then any authorized extension to lower homepage/product/cart/checkout screens. Supplier confirmations and other V1 catalog limitations remain. No prices, weights, stock, provenance or families were invented.
