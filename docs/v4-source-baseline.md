# V4 development baseline

Verified base f9ca9d0ec50ea04216a7e9bb9d4d3eff4cba7d04 from complete Visual Correction V2 bundle. Source checkout clean before branch feat/partner-fulfillment-p0-v4. No backend difference from c3036cd. Referenced 5b7324 object is unavailable; not overwritten or claimed reviewed. GitHub heads checked at start: storefront/redesign refs absent. Work stays in isolated local branch, no merge/deployment. CEO Task V4 authorizes test-only implementation, not price publication/live payment/partner dispatch.

Stage B: cart removal tolerates discontinued products. Runtime requires persisted owner-scoped 15-minute server quote; changed price/catalog/cart triggers conflict and explicit return to cart for new consent. Legacy fixed-unit regressions now obtain quote as a real caller would; no assertion or timeout removed. Two new regression tests. Schema migration expectations updated for added quote table.
