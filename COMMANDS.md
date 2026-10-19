# Phase 1 command log

Commands below were executed with PowerShell. Source files were authored with the file patch tool, rather than a scaffolding CLI. No MongoDB, authentication, dashboards, or other business modules were generated.

## Inspection (workspace root)

```powershell
Get-Content -LiteralPath 'C:\Users\Admin\.codex\attachments\f464be6e-1d31-426c-9d5c-e4abd3042805\pasted-text.txt'
Get-ChildItem -Force
Get-Location
node --version
npm --version
rg --files --hidden -g AGENTS.md -g '!node_modules' -g '!.git'
Get-ChildItem -LiteralPath FitTrack -Force
Test-Path FitTrack/backend/package.json
Get-ChildItem FitTrack/frontend/src
Test-Path FitTrack/backend/package.json
Get-ChildItem FitTrack/frontend -Name
```

The workspace was empty; rg found no AGENTS.md. Node: v24.18.0; npm: 11.16.0.

## Reserved folders (workspace root)

```powershell
$folders = @('frontend/src/context','frontend/src/utils','frontend/public','backend/src/models','backend/src/services','backend/src/utils','backend/src/validators'); foreach ($folder in $folders) { New-Item -ItemType Directory -Force -Path (Join-Path 'FitTrack' $folder) | Out-Null; New-Item -ItemType File -Force -Path (Join-Path 'FitTrack' "$folder/.gitkeep") | Out-Null }
```

## Install (FitTrack/frontend)

Initial sandbox attempt (interrupted after the registry-access restriction was identified):

```powershell
npm install react react-dom; npm install -D vite @vitejs/plugin-react
```

Successful permission-enabled retry:

```powershell
npm install react react-dom --fetch-retries=0 --fetch-timeout=20000; npm install -D vite @vitejs/plugin-react --fetch-retries=0 --fetch-timeout=20000
```

## Install (FitTrack/backend)

```powershell
npm install express dotenv --fetch-retries=0 --fetch-timeout=20000
```

This failed with EACCES against registry.npmjs.org in the sandbox. The exact same command was repeated with network permission and succeeded. Both dependency installations reported zero vulnerabilities.

## Verification and development servers

In FitTrack/backend:

```powershell
npm test
npm run dev
```

In FitTrack/frontend:

```powershell
npm run build
npm run dev
```

After adding the frontend Node engine requirement and refining the mobile font scaling:

```powershell
npm install --package-lock-only --ignore-scripts --offline --no-audit; npm run build
```

The browser was opened through the browser tool at http://127.0.0.1:5173 (not through a shell command). It rendered the welcome page and Backend connected status. Desktop and mobile layouts were inspected. The backend tests cover health, JSON 404 responses, and malformed JSON handling.

Documentation was written using PowerShell single-quoted here-strings piped to Set-Content. The source tree was generated using Get-ChildItem, excluding node_modules and dist. These authoring operations are not additional setup steps to rerun.

## Phase 2 commands

Inspection used Get-Content on backend/package.json, src/config/env.js, src/server.js, src/app.js, src/controllers/healthController.js, src/routes/healthRoutes.js, tests/health.test.js, .env.example, and README.md, plus:

```powershell
Get-Command mongod,mongosh,docker -ErrorAction SilentlyContinue | Select-Object Name,Source
Get-Service -Name '*Mongo*' -ErrorAction SilentlyContinue
rg --files --hidden -g AGENTS.md -g '!node_modules' -g '!.git'
Test-Path FitTrack/backend/.env
Get-NetTCPConnection -LocalPort 27017,5000 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess
```

The existing MongoDB service was running. No MongoDB server installation was needed.

In FitTrack/backend:

```powershell
npm install mongoose --fetch-retries=0 --fetch-timeout=20000
npm test
npm run check:db
npm run dev
```

The npm install command initially failed with sandbox EACCES and succeeded when repeated with network permission. Configuration and source files were authored using file patches and PowerShell Set-Content. A .env file was copied only after checking it did not exist:

```powershell
if (!(Test-Path FitTrack/backend/.env)) { Copy-Item FitTrack/backend/.env.example FitTrack/backend/.env }
```

The check:db script was added to package.json with ConvertFrom-Json, Add-Member, and ConvertTo-Json. Documentation and the source tree were updated with Set-Content/Add-Content.

Final verification:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:5000/api/ready | ConvertTo-Json
```

Results: 8/8 tests passed; live database integration passed (200 connected, 503 disconnected); running API returned healthy and database connected. The frontend was unchanged in Phase 2.

## Phase 3 commands

Inspected the existing backend using rg --files and Get-Content on app.js, config/env.js, middleware/errorHandler.js, server.js, package.json, tests/env.test.js, README.md, and .gitignore. No existing auth files were present.

From FitTrack/backend:

```powershell
npm install bcrypt jsonwebtoken express-rate-limit --fetch-retries=0 --fetch-timeout=20000
npm test
npm run test:integration
npm run dev
```

The install first failed with sandbox registry EACCES, then the exact command succeeded with network permission. npm reported zero vulnerabilities. npm noted bcrypt's install script was not approved; the packaged native binary worked and all real hash/compare tests passed without changing npm script policy.

Source and test files were authored with PowerShell single-quoted here-strings and Set-Content. app.js/server.js were updated with targeted text replacements. package.json scripts were added using ConvertFrom-Json/Add-Member/ConvertTo-Json. A cryptographically random 48-byte JWT secret was generated locally and appended only when .env had no existing nonempty JWT_SECRET; its value was never printed. .env.example contains only a blank placeholder.

No real admin/member accounts were seeded. Authentication integration tests used a new local fittrack_test_* database and removed only that database after verification. The frontend was unchanged. README.md and STRUCTURE.md were updated to reflect Phase 3.

Results: npm test passed 13 tests; npm run test:integration passed all 14 child scenarios plus their parent (15 reported tests).

Live verification commands:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/ready | ConvertTo-Json
$protectedResponse = Invoke-WebRequest http://127.0.0.1:5000/api/auth/me -SkipHttpErrorCheck
[pscustomobject]@{ Status = [int]$protectedResponse.StatusCode; Body = $protectedResponse.Content } | ConvertTo-Json
```

The running server reported database connected and returned 401 Authentication required for an unauthenticated profile request.

## Phase 4 commands and verification

Frontend dependencies installed during the initial Phase 4 implementation:

```powershell
cd FitTrack/frontend
npm install react-router-dom axios --fetch-retries=0 --fetch-timeout=20000
npm test
npm run build
npm run dev
```

Installation initially failed with sandbox EACCES and succeeded with network permission. Resuming Phase 4 did not require any additional packages.

Backend regression commands, from FitTrack/backend:

```powershell
npm test
npm run test:integration
npm run dev
```

Results on September 24, 2026: 11 frontend tests, 13 backend tests, and 14 authentication integration scenarios passed (15 reported integration tests including the parent). The Vite production build passed.

Inspection used Get-Content and rg --files for source, tests, package manifests, and documentation. Temporary Node scripts piped to node --input-type=module created three uniquely identified browser-test accounts, then deleted exactly those accounts using both their IDs and emails. No permanent demo credentials were added. The integration suite used its own isolated database and removed it afterward.

Browser checks: guest redirection and safe post-login return, member profile saving, logout, trainer workspace, and admin workspace. The initial implementation also exercised registration and mobile profile/navigation. Browser session access ended before the final role-change UI check; server-side role enforcement passed the integration suite. All three temporary browser-test accounts were removed.

README.md and STRUCTURE.md were updated using Python via PowerShell here-strings. The frontend and backend development servers were started on local ports 5173 and 5000. Phase 5 was not started.

## Phase 5 commands and verification

Inspected source using rg --files and Get-Content. Authored the dashboard service/controller/routes, React page/hook/service, CSS, and isolated integration test using Python via a PowerShell here-string (`@' ... '@ | python -`). Updated app routing and admin navigation. No dependencies installed.

From FitTrack/backend:

```powershell
npm test
npm run test:integration
```

From FitTrack/frontend:

```powershell
npm test
npm run build
```

Results: 13 backend tests, 11 frontend tests, and 18 integration scenarios passed (20 integration results including parent tests); production build succeeded. Existing development servers returned HTTP 200 for frontend and API health requests using Invoke-WebRequest.

Temporary fixture scripts were piped to node --input-type=module from the backend directory. They created one uniquely named admin test account, changed only that account's role for access-revocation/retry checks, then deleted it by matching its exact ID and email and removed the fixture metadata file. No existing application account was modified. Browser tools verified the live dashboard, desktop and 390px mobile views, denied-access clearing, and retry recovery. The viewport override was reset afterward.

README.md and STRUCTURE.md updated. Phase 6 not started.

## Phase 6 completion — September 26, 2026

Resumed the interrupted member-management phase. Inspected the implementation and earlier task history. Ran npm test and npm run build in frontend; ran npm test and npm run test:integration in backend. Frontend: 11 passing tests and successful build. Integration: 26 passing scenarios (29 results including parents). Backend: initial startup test exceeded its 12-second child-process deadline; rerunning npm test passed all 13 tests without changes.

Cleanup used a Node script from backend, reading .phase6-fixtures.json and matching each of its three accounts by exact ID, email, and role. It deleted only matched accounts and their Member profiles, then removed the fixture metadata file. Existing application accounts were preserved. No dependencies were installed. Updated README.md and STRUCTURE.md. Phase 7 has not started.

## Phase 7 commands and verification — September 26, 2026

Inspected the original phase plan and existing models, validators, services, controllers, routes, and React components using Get-Content. Authored the trainer module and integration tests with Python through PowerShell here-strings. Reused member directory/account-form components with a trainer mode and existing responsive styles. No dependencies installed.

From frontend:

```powershell
npm test
npm run build
npm run dev -- --host 127.0.0.1
```

From backend:

```powershell
npm test
npm run test:integration
npm run dev
```

Results: 11 frontend tests, 13 backend tests, and 34 integration scenarios passed (38 integration results including parents). The build passed and was repeated successfully after repairing UTF-8 punctuation in the reused screens. Development servers started on ports 5173 and 5000.

Temporary Node scripts piped to node --input-type=module created three uniquely identified Phase 7 accounts and one member assignment for browser verification. Cleanup matched exact IDs, emails, and roles from .phase7-fixtures.json before removing those accounts and associated Member/Trainer profiles, then removed the metadata file. No existing application account was modified. Browser checks verified desktop/mobile profile controls, saves, overlap rejection/recovery, search, workload, and shared member form saving. Viewport override reset. Updated README.md and STRUCTURE.md. Phase 8 not started.

## Phase 8 completion — September 28, 2026

Resumed the existing membership implementation. Ran frontend npm test (12 passing) and npm run build (passed); backend npm test (13 passing) and npm run test:integration (44 scenarios, 49 total results, all passing). Fixed server startup to create MembershipPlan indexes because database autoIndex is disabled. Confirmed nameKey_1 is unique in the live database. Increased the startup test watchdog from 12 to 30 seconds for cold Windows module loading; the full suite passed afterward without weakening assertions.

Started backend and frontend with npm run dev on localhost ports 5000 and 5173. Browser checks exercised the recorded Phase 8 fixtures: edited plan price, verified historical price retention, opened the membership directory, previewed and saved a renewal, and inspected mobile coverage/history at 390px. Saved phase8-mobile.png and reset the viewport.

Cleanup matched both fixture accounts by exact ID/email/role, deleted their membership/profile records, checked that no other member referenced the uniquely named fixture plan, then deleted that plan and .phase8-fixtures.json. No dependencies installed. README.md and STRUCTURE.md updated. Phase 9 not started.

## Phase 9 completion — September 29, 2026

Resumed the interrupted session-scheduling phase. The prior run implemented booking, rescheduling, cancellation, completion, role-specific schedules, dashboard integration, and reservation indexes. Its browser checks verified member booking, rescheduling, cancellation/history, and a 390px mobile layout, saved as phase9-mobile.png. Admin browser verification was interrupted; admin and trainer permissions are covered by integration tests.

Re-ran frontend npm test (12 passed) and npm run build (passed), plus backend npm test (13 passed) and npm run test:integration (55 scenarios, 61 results including parent tests, all passed). No dependencies installed.

Cleanup verified all three recorded Phase 9 account identities by exact ID, email, and role. Verified that the associated session referenced only fixture participants and creator, then removed one fixture session, the fixture Member/Trainer/Membership records, and the three accounts. Removed .phase9-fixtures.json after successful cleanup. Existing application accounts were preserved. README.md and STRUCTURE.md describe the completed phase. Phase 10 has not started.

## Phase 10 completion — September 29, 2026

Inspected source files and the original requested development plan. Added Exercise, WorkoutPlan, and WorkoutAssignment models, workout validators/service/controller/routes, startup indexes, role-specific workout pages, reusable forms/pickers, and completion/history views. Updated workspace navigation and member profile links. No dependencies installed.

Commands run from backend:

```powershell
node --test integration/workouts.test.js
npm test
npm run test:integration
npm run dev
```

Commands run from frontend:

```powershell
npm test
npm run build
npm run dev
```

Results: workout suite passed 11 scenarios (12 including its parent); full integration suite passed 66 scenarios (73 results including parents); backend unit/HTTP/startup suite passed 13 tests; frontend suite passed 12 tests. Production build passed. Rebuilt after the workout page-title label change. Development servers run locally on ports 5000 and 5173.

Browser verification created an exercise and two-day plan, assigned it to the temporary member, saved member completion, confirmed trainer progress and archival history, and checked a 390px mobile layout with no horizontal overflow. Saved phase10-mobile.png and reset the viewport. Temporary test tabs closed.

Fixture scripts were piped to node --input-type=module. Created three uniquely named trainer/member/admin test accounts with a random temporary password and recorded exact IDs/emails/roles in .phase10-fixtures.json. Cleanup validated every account identity and ensured workout/member references did not involve other accounts, then deleted exactly one workout assignment, one plan, one exercise, one member profile, and those three users. Removed fixture metadata after successful cleanup. All automated integration tests use randomly named fittrack_test_* databases and drop only their own database afterward.

README.md and STRUCTURE.md updated. Added PHASES.md so the remaining one-phase-at-a-time plan is available locally. Phase 11 (attendance) is next and has not started.

## Phase 11 completion — September 29, 2026

Resumed interrupted attendance implementation and reviewed API, role routes, persistence indexes, history/report screens, and integration coverage. No dependencies added.

- backend: npm test — 13 passed.
- backend: npm run test:integration — 83 reported results passed (75 scenarios plus 8 parent tests), including 9 attendance scenarios.
- frontend: npm test — 12 passed.
- frontend: npm run build — passed.

Integration tests use isolated randomly named fittrack_test_* databases and remove them in their cleanup hooks. No application database fixtures were created during this completion run. Browser interaction and mobile visual verification remain unperformed for Phase 11. Updated README.md, STRUCTURE.md, and PHASES.md. Phase 12 has not started.


## Phase 12 completion — September 29, 2026

Resumed the implemented payment phase. Prior run passed backend npm test (13), frontend npm test (12), backend npm run test:integration (93 reported results), and frontend npm run build. No implementation changes or dependencies were needed in the completion run.

Ran node scripts/verify-payment-ui.mjs from backend for a disposable local app on port 5199 backed by its own fittrack_test_payment_ui_* database. Verified the member payment flow through pending, failure, retry, and success, and all four history events. Saved phase12-payments.png. Browser tab closed. Updated README.md, STRUCTURE.md, and PHASES.md. Admin browser and mobile verification remain unperformed; API authorization and revenue calculations passed integration tests in the implementation run.

Cleanup verified the exact payment ID and both fixture account identities before dropping only this run's disposable database. The normal application database was not modified.


## Phase 13 verification — September 29, 2026

Implemented progress model, validators, service, controller, routes and startup index; added member/admin editing, assigned-trainer reading, charts, history, and live workout completion. Added navigation and profile links. No dependencies installed.

Commands executed (from the corresponding backend/frontend directory):

- backend: node --test integration/progress.test.js — 8 scenarios plus parent passed.
- frontend: npm test — 15 passed.
- backend: npm test — 13 passed.
- backend: npm run test:integration — 102 results passed (92 scenarios plus 10 parents).
- frontend: npm run build — passed, repeated after final mobile styling changes.
- backend: node scripts/verify-progress-ui.mjs — isolated browser app on 127.0.0.1:5200; randomly named fittrack_test_progress_ui_* database, random temporary credentials, disposable member/trainer/admin and measurement fixtures. Run with an interactive terminal; Enter triggers shutdown and database cleanup. A 15-minute timer also cleans up automatically.

All integration tests use isolated fittrack_test_* databases and clean up their own databases. Browser test does not write application data.


Browser verification: member creation and correction of a progress entry, recalculated BMI and weight change, saved notes/revision, BMI chart selection and accessible values table, trainer member selection and read-only history all passed. A 390px viewport check showed no horizontal overflow (375px content width including scrollbar allowance). Increased mobile chart label size and panel spacing, rebuilt successfully, and verified final styling. Saved phase13-progress.png and phase13-mobile.png; viewport reset and test tab closed. Admin mutation authorization was verified in integration tests; admin browser flow was not separately exercised.

Cleanup confirmed the exact disposable member ID and all three fixture identities, removed only this run's progress-test database, and verified that no verify-progress-ui.mjs process remained. Application data was preserved. Phase 13 is complete; Phase 14 has not started.

## Phase 14 verification — September 29–30, 2026

Implemented the notification API, indexed persistence, source reconciliation, role inboxes, header badge, filtering, pagination, read controls, and visible-page refresh. No dependencies installed.

Commands executed from the corresponding backend/frontend directory:

- backend: npm test — 13 passed.
- backend: npm run test:integration — 111 reported results passed (100 scenarios plus 11 parent tests), including eight notification scenarios and their parent.
- frontend: npm test — 15 passed.
- frontend: npm run build — passed.
- backend: node scripts/verify-notification-ui.mjs — disposable app on 127.0.0.1:5201 using a randomly named fittrack_test_notification_ui_* database and random temporary credentials.

The UI fixture prints its run-specific stopFile path. Creating that exact file requests server shutdown and removal of only its own database; it also supports Enter, shutdown signals, and a 15-minute cleanup timer. The interrupted earlier run's database was removed after validating its exact name and all three fixture identities. The completion run exited successfully with “Disposable notification database removed.” Application data was preserved.

Browser checks passed for all five categories, mark-read with unread badge update, read filtering, workout detail navigation, and paid demo payment reminder removal. At 390px the document width and scroll width were both 375px, with readable filters and notification cards. Saved phase14-notifications.png and phase14-mobile.png, reset viewport, and closed the test tab. Trainer/admin UI flows were not separately checked; automated integration tests cover role behavior. Updated README.md, STRUCTURE.md, and PHASES.md. Phase 14 is complete; Phase 15 has not started.

## Phase 15 verification — September 30, 2026

Implemented admin-only analytics, strict date/interval validation, aggregate reports, daily/monthly bar charts, exact-value tables, navigation, and query indexes. No dependencies added.

- backend: node --test integration/analytics.test.js — four scenarios plus parent passed; repeated successfully after query indexes were added.
- backend: npm test — 13 passed.
- backend: npm run test:integration — 116 reported results passed (104 scenarios plus 12 parent tests).
- frontend: npm test — 15 passed.
- frontend: npm run build — passed; repeated after filter and mobile card styling changes.
- backend: node scripts/verify-analytics-ui.mjs — disposable app on 127.0.0.1:5202, random credentials and its own fittrack_test_analytics_ui_* database.

Initial analytics test fixtures were corrected to await collection/index initialization and provide distinct attendance days, payment period IDs and session reservations. The resulting suite verifies zero-filled periods, calendar/time bounds, daily/monthly totals, distinct visitors, retained history, simulated paid revenue, invalid input, admin-only access, and no-store responses.

Browser verification: admin login and navigation, populated monthly report (10 registrations, 9 visits, 1 visitor, INR 11,250 demo revenue), matching revenue chart/table, daily zero-revenue dates, and mobile menu all passed. Filter styling was refined. A mobile currency wrap was fixed by using one summary card per row. The final 390px viewport had 375px document and scroll widths; summary amounts and chart labels remained readable. Screenshots: phase15-analytics.png and phase15-mobile.png. Reset viewport and closed the browser tab.

Requested cleanup by creating this fixture's printed, identity-specific stopFile. The fixture closes its server and removes only its own randomly named database. Application data was preserved. Phase 15 is complete; Phase 16 has not started.

Phase 15 cleanup confirmed September 30, 2026: the interrupted fixture server was no longer responding on port 5202, but its database and stop marker remained. Validated the exact run-specific database name and all three analytics fixture account identities, removed only that fixture database, verified its absence, and removed its stop marker. No application database was modified. Earlier test and browser results above remain the verification record; no application code changed during cleanup.

## Phase 16 verification — September 30, 2026

- frontend: npm test — all 15 passed.
- frontend: npm run build — passed, including final specificity fix.
- Browser: 320px dashboard and analytics document/scroll widths both 305px; 768px analytics both 753px; 1024px analytics both 1009px (scrollbar gutter reserved).
- Navigation: named dialog, Escape returns focus to opener with aria-expanded=false, analytics link closes menu, crossing desktop breakpoint closes modal.
- Final analytics input font computed to 16px; values table keyboard-focusable and locally scrollable. Screenshot: phase16-mobile.png.
- Reset viewport and closed test tab. Existing disposable analytics fixture used; no application data changed.

Phase 16 complete. Phase 17 has not started.
Cleanup verified: the exact analytics UI fixture database and stop marker are absent, and port 5202 is closed.

## Phase 17 verification — September 30, 2026

- backend: npm test — 18 passed.
- backend: npm run test:integration — 116 results passed (104 scenarios plus 12 parent tests), using isolated randomly named databases with suite cleanup.
- frontend: npm test — 16 passed.
- frontend: npm run build — passed.

Added five API boundary/error tests and one frontend error-message test. HTTP cases cover 200/404/401 response headers, malformed JSON (400), excessive JSON (413), plain text, unsupported charset and compressed JSON (415), and authentication on bodyless logout/malformed protected paths. Unit checks cover safe database errors, URI errors and headers-sent delegation. Existing full integration suite passes with stricter body handling. No browser check was needed for these nonvisual changes. No dependencies added or application data changed. Phase 17 complete; Phase 18 has not started.

## Phase 18 verification — September 30, 2026

Initial frontend regression run: 16 passed, three newly added tests failed, reproducing malformed-session admission, stale expiry and invalid-profile replacement. Applied session-store fixes and added two API adapter regressions. Final frontend npm test: 21 passed. Backend npm test: 18 passed. Backend npm run test:integration: 116 passed (104 scenarios plus 12 parents). Frontend npm run build: passed. No skipped tests or failing results in the final runs.

Created TESTING.md with defect evidence, test scope and limitations. No browser fixture/server was launched. No dependencies added or application data changed. Phase 18 complete; Phase 19 has not started.

## Phase 19 verification — September 30, 2026

- node --test integration/demo.test.js: 7 reported results passed (six scenarios and one parent).
- npm run test:integration: 123 passed, zero failed/skipped.
- Prepared local showcase fittrack_demo_showcase_4a68d92d via seed-demo.js with random password; credentials/config saved using exclusive creation in ignored backend/.env.demo.local. Existing .env preserved.
- HTTP verification: admin/trainer/member login passed; admin analytics/members/payments and trainer/member sessions/notifications reads returned 200. Temporary server closed and MongoDB disconnected.

Added DEMO.md. Showcase retained intentionally for use; isolated regression databases cleaned by tests. No frontend code changes or new dependencies. Phase 19 complete; Phase 20 has not started.

## Phase 20 verification — September 30, 2026

- frontend npm test: 21 passed; npm run build: passed.
- backend npm test: 18 passed; npm run test:integration: 123 passed.
- node --check backend/src/server.js: passed.
- Both package manifests agree with lockfile dependency declarations.
- Known-local-credential scan over 200 publishable text files: no matches.
- Browser: lazy landing/login/admin analytics loads passed; 390px layout retained 16px controls and no page overflow. Saved phase20-mobile.png, reset viewport and closed tab.

Added lazy page loading and a recovery boundary; moved styles into fixed main.jsx order. Updated stale landing copy. Removed raw startup error logging and fixed recursive shutdown-error handling. Replaced historical README with fresh-checkout guidance, retained reference in FEATURES.md, refreshed STRUCTURE.md, and added DEPLOYMENT.md, PUBLISHING.md and .github/workflows/verify.yml. GitHub workflow has not run remotely. No git initialization, commit, remote publication or production deployment performed.

All 20 phases complete locally. Existing isolated showcase retained. Disposable browser fixture cleanup requested with its exact stop marker.
Cleanup confirmed: disposable preview exited successfully and reported its analytics database removed.
