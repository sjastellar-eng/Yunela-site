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
- Exact390×844 and1440×1000 layout acceptance completed after publication (see results below). Two unlinked noindex QA fixture pages public/qa/task17-390.html and task17-1440.html embed the actual same-origin app at fixed CSS viewports. The browser host window cannot be resized by the available API; real iframe innerWidth and layout are measured instead, not simulated by image resizing or cropping a differently-sized app.
- Local HTTP preview cannot run the existing app's crypto.randomUUID secure-context API. No production UUID code or browser security setting was modified to compensate. The HTTPS published app will be tested in the same-origin QA frames.

Evidence logs: evidence/task17. Post-live commit/deploy ID, keyboard open/back, image loading, real frame measurements and four screenshots will be appended after deployment. No browser PASS is claimed in advance.

## Published acceptance — 2026-10-29 23:00 UTC / 2026-10-30 Kyiv

Published commit **3ea70d9bb04bbf82f2eb2431df6373cafddf3949**, Render deploy **dep-dbhsvdek1f9s73e4sj8g**, LIVE finished22:59:35 UTC. Tree6aa212be0a9c2b7ff320c7dd6f86e106410c293e matched local tested source. Main https://yunela-v92-demo.onrender.com/ now serves /assets/index-CdHn5gKo.js and /assets/index-Vg_Z8ZlA.css. Robots noindex,nofollow,noarchive confirmed. Initial stale cached root HTML cleared on later live reload; final root uses current bundle.

| Scenario | Expected | Actual | Result |
|---|---|---|---|
| Supplied face | Same recognizable curls/smile; cup if practical | Deterministic upper-left crop; curls/smile/cup visible | PASS |
|390×844 frame | Circle, readable face, caption within entry, no obstruction |176×176 image; caption inside226px button; document scrollWidth375<=390 | PASS |
|1440×1000 frame | Same constraints |280×280 image; caption inside337.5px button; scrollWidth1425<=1440 | PASS |
| Open assistant at both widths | Existing discovery screen and portrait header | Enter activates entry;48×48 loaded avatar and exact caption | PASS |
| Keyboard return | Existing home navigation works | Enter on YUNELA home restores entry | PASS |
| Access name | Native button has useful exact label | Юна — твій чайний гід; visible keyboard focus ring | PASS |
| Mobile caption | Does not overlay content | In normal flow, no fixed overlay; initial flex-shrink clipping found and corrected | PASS |
| Image requests / console | Images loaded, no application errors | complete=true; no HTTPS app errors in captured console | PASS |
| Complete native1440px screenshot | Full-width browser screenshot | Full-page/clip screenshot API timed out; browser capture shows1341×921 portion of actual1440px frame | BLOCKED |

The exact-width layout checks are actual same-origin iframe innerWidth measurements, not resized screenshots or alternate widths. Desktop screenshots include the entire avatar and dialogue/header, but rightmost frame area is outside the browser capture. No device hardware emulation or complete network trace is claimed. The mobile screenshots crop only the actual390×844 frame from the browser capture without resizing. Browser measurements and limits: evidence/task17/browser-measurements.json.

Screenshots: [390 entry](evidence/task17/yunela-task17-390-entry.jpg), [390 opened](evidence/task17/yunela-task17-390-open.jpg), [1440 entry, visible portion](evidence/task17/yunela-task17-1440-entry.jpg), [1440 opened, visible portion](evidence/task17/yunela-task17-1440-open.jpg). All capture the published commit above. Native orange focus ring intentionally retained as accessibility evidence.

Final TypeScript, ESLint, image validation,10 discovery tests and static production build PASS (logs updated). Scope proof: evidence/task17/scope.json. No paid resources, backend, commercial actions or Task16 infrastructure introduced. Test helper pages are unlinked and noindex. This evidence-only follow-up does not require redeployment.
