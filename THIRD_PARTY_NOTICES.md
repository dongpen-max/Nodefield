# Third-Party Notices

Nodefield was designed from a clean-room synthesis of public product and architecture patterns. No surveyed application source code, branding, documentation, or assets were copied into this project.

Runtime and build dependencies include:

- React and React DOM, MIT License: https://github.com/facebook/react
- React Flow (`@xyflow/react`), MIT License: https://github.com/xyflow/xyflow
- Lucide, ISC License: https://github.com/lucide-icons/lucide
- Vite, MIT License: https://github.com/vitejs/vite
- Vite Plugin PWA, MIT License: https://github.com/vite-pwa/vite-plugin-pwa
- Workbox, MIT License: https://github.com/googlechrome/workbox
- Vitest, MIT License: https://github.com/vitest-dev/vitest

Development-only test dependencies include:

- Playwright Test (`@playwright/test`), Apache License 2.0: https://github.com/microsoft/playwright

Playwright and its downloaded browser binaries are used only for automated testing and are not
included in the Nodefield runtime or production bundle. Browser distributions retain the notices
and licenses shipped by their respective projects.

Research-only references with additional restrictions are not dependencies:

- tldraw uses a custom license that requires authorization for production SDK use.
- AFFiNE uses path-dependent licensing that requires file-level review.
- basketikun/infinite-canvas uses AGPL-3.0.

See `docs/blueprint.json` and the workspace research report for the evidence-backed synthesis.
