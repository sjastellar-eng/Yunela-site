# Task 17 — supplied Yuna avatar

Date:2026-10-30 Europe/Kyiv. Base remote staging HEAD:bb1734e26ee007e3870fc734fb2a68752d5e0644; published baseline592756bd1c9bb124574388bb1d9c2bcc14004e73. Isolated task branch fix/task-17-yuna-avatar; Task16 remains paused and its server/disk work is not merged.

## Asset preparation

Original supplied collage archived unchanged at assets/source/yuna/portrait-original.png (563747bytes). Crop coordinates205,180,565,540 select the large upper-left portrait. Deterministic crop, circular alpha, Lanczos resize, WebP90/method6. No generation, face retouch, color adjustment or invented portrait. Curls, smile and cup remain visible. Provenance and hashes: assets/source/yuna/PREPARATION.json.

Public160px WebP10392bytes;320px WebP25368bytes. Source is not in public hosting. Responsive srcset chooses the appropriate avatar; image dimensions,1:1 ratio and circular clipping prevent distortion.

## Existing behavior and scope

The actual baseline has an inline YUNA discovery section, not a floating modal widget. Decorative Y appears in the home-page circular visual and dialogue speaker. Replaced these with supplied portrait; existing header navigation button gains the same avatar and exact accessible/visible label «Юна — твій чайний гід». Home visual is a native keyboard-accessible button calling the existing go('finder') navigation. Existing home/back navigation and stateful Yuna component are retained. No new popup, overlay, backend or payment behavior.

Caption is in normal flow, including mobile; no fixed-position label covers content. LogoYUNELA, catalog imports/creative manifests/prices/checkout logic and noindex unchanged. Task16 infrastructure files and paid resources are excluded.

## Validation before publication

- TypeScript PASS; ESLint PASS.
- Image validation56products/347 existing creative files PASS.
- Existing Yuna discovery tests10/10 PASS; no mirrored avatar snapshot tests added for this low-impact edit.
- VITE_STATIC_DEMO=1 production build PASS.
- Exact390×844 and1440×1000 acceptance pending publication in this commit. Two unlinked noindex QA fixture pages public/qa/task17-390.html and task17-1440.html embed the actual same-origin app at fixed CSS viewports. The browser host window cannot be resized by the available API; real iframe innerWidth and layout are measured instead, not simulated by image resizing or cropping a differently-sized app.
- Local HTTP preview cannot run the existing app's crypto.randomUUID secure-context API. No production UUID code or browser security setting was modified to compensate. The HTTPS published app will be tested in the same-origin QA frames.

Evidence logs: evidence/task17. Post-live commit/deploy ID, keyboard open/back, image loading, real frame measurements and four screenshots will be appended after deployment. No browser PASS is claimed in advance.
