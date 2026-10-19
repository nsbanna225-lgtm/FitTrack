# Phase 18 regression report

Verified September 30, 2026. This report records automated regression evidence, not a claim of exhaustive testing.

## Reproduced defects and fixes

Three new tests failed against the Phase 17 code before fixes:

1. Session responses with missing/non-text names or IDs were accepted. Workspace rendering uses these fields, so malformed responses could break the UI. Session admission now validates identity fields and rejects lifetimes exceeding the JavaScript timer range.
2. A captured expiry callback from an earlier session cleared a replacement login when invoked after replacement. A session generation guard now makes obsolete callbacks harmless, independently of timer cancellation.
3. Profile responses with invalid names or a different user ID replaced the signed-in identity. Updates now require a valid identity matching the current user and expected token; valid role updates still apply.

The three tests pass after the fixes. Two additional API tests verify that a delayed 401 cannot clear a newer login, and that server failures and cancelled requests preserve a valid session. API test fixtures now include the same ID/name fields returned by the backend's publicUser serializer.

## Verification

| Area | Command | Result |
| --- | --- | --- |
| Frontend session, API, input and chart behavior | frontend: npm test | 21 passed |
| Backend configuration, HTTP boundary and startup | backend: npm test | 18 passed |
| Authentication and all implemented business modules | backend: npm run test:integration | 116 passed: 104 scenarios plus 12 parent tests |
| Production bundle | frontend: npm run build | Passed |

Integration coverage includes authorization and ownership, malformed input, token revocation, concurrent writes, optimistic versions, pagination, date boundaries, retained history, notifications and aggregate analytics. Suites use isolated random test databases and clean them up. No application database changes or new dependencies were required.

## Limits

Session races use controlled callbacks and deferred adapter responses so they can be reproduced deterministically. Browser checks from Phase 16 remain recorded in COMMANDS.md; they were not rerun for these nonvisual changes. There is no automated browser end-to-end suite or coverage-percentage claim. Physical-device/cross-browser testing, production deployment, load testing, Atlas connectivity, live payments and password-reset email delivery were not verified by this phase.

Phase 18 is complete. Phase 19 (demo/sample data) is next.

## Final verification — Phase 20

September 30, 2026: backend tests 18 passed; integration results 123 passed (110 scenarios plus 13 parent tests); frontend tests 21 passed; production build passed. Dependency manifest/lockfile agreement checked for both packages. A scan of 200 publishable text files found no literal copies of the known local JWT/demo password values; this is not a general-purpose secret audit.

All route pages now load on demand through lazy/Suspense with an error fallback for failed rendering/chunk loads. Shared styles load in a fixed order, ending with responsive overrides. Previous single JavaScript bundle: 463.09 kB (134.51 kB gzip). New entry: 270.64 kB, with 61.69 kB of modulepreloads (332.33 kB combined before the route chunk, about 28% less). The landing page adds its own 4.00 kB chunk; total application code is not reduced by that percentage. No runtime speed or Lighthouse result is claimed.

Browser smoke: updated landing copy, login, protected admin navigation and analytics rendered successfully. At 390px, document and scroll widths both measured 375px, and form inputs computed to 16px. Screenshot: phase20-mobile.png. Other routes were build-checked but not each browser-exercised in this phase. Missing-chunk fallback was not fault-injected. GitHub Actions is prepared but has not executed remotely. Production deployment remains unverified.
