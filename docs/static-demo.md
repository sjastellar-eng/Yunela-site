# Free Render interface demo

Branch feat/render-static-demo derives from reviewed V6 (1bec564a05318d4adaafbaaaea4f939f7cdfcdf2). This branch is a public, noindex, read-only visual demonstration. No server, SQLite or paid disk is provisioned. No login/password is required; no client-side password is presented as security.

Build: npm ci --ignore-scripts --include=dev, then VITE_STATIC_DEMO=1 npx vite build; publish dist. Native SQLite install scripts are unnecessary for this browser-only build. Static pages use in-memory navigation at /.

The demo loads only public/demo-catalog.json, sanitized to exclude procurement notes/prices and supplier contact data. All offers are requests with NULL price/stock; no invented claims. Browser API mutations are blocked; no order, payment, account or operator operation is sent. No personal information is collected. The full V6 backend remains on its own branch for later paid staging.

noindex metadata and robots.txt discourage indexing; this does not restrict public access. Only public catalogue photos and editorial assets are deployed. Static hosting has no fixed compute charge; workspace bandwidth/build allowances still apply. Auto-deploy is disabled.
