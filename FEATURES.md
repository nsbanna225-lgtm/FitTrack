# Feature reference and implementation history

Advanced Fitness Management System. Completed: project foundation, MongoDB configuration, backend authentication/authorization, and frontend authentication with separate admin, trainer, and member layouts. The admin dashboard shows live account statistics, registration trends, recent members, and membership coverage. Member management, trainer management, and membership plans/enrollment/renewal are available. Session booking, role-specific schedules, and workout management are available. Attendance check-ins, history, percentages, and admin reports are available. Simulated membership payments, payment history, retries, and admin revenue totals are available. Fitness progress includes measurements, BMI, notes, history, charts, and workout completion. In-app notifications include booking updates, session reminders, membership expiry, demo payment reminders, and workout updates.

## Requirements

Node.js 22.12+ (tested with 24.18.0), npm (tested with 11.16.0), and a running local MongoDB service. The default database is mongodb://127.0.0.1:27017/fittrack.

## Run locally

For fresh-checkout setup, follow README.md. The following sections retain detailed implementation and historical verification notes. From two terminals inside FitTrack:

```powershell
cd backend
npm install
npm run dev
```

```powershell
cd frontend
npm install
npm run dev
```

Visit http://127.0.0.1:5173. GET http://127.0.0.1:5000/api/health checks API liveness; GET /api/ready performs a live MongoDB ping and returns 200 when connected or 503 when unavailable.

For a fresh checkout, copy backend/.env.example to backend/.env only if it does not exist. Set MONGODB_URI and a cryptographically random JWT_SECRET of at least 64 characters before starting. Never commit the real .env file, print its contents, or put secrets in the frontend. To generate the secret directly into a fresh .env from the backend directory:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
$envText = Get-Content -Raw .env
if ($envText -match '(?m)^JWT_SECRET=\s*$') {
  $secretBytes = [byte[]]::new(48)
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($secretBytes)
  $newSecret = [Convert]::ToHexString($secretBytes)
  $envText -replace '(?m)^JWT_SECRET=\s*$', "JWT_SECRET=$newSecret" | Set-Content .env
  Remove-Variable newSecret,secretBytes,envText
}
```

The backend loads .env relative to its directory; process environment variables take precedence. Changing JWT_SECRET invalidates all outstanding tokens. Changing the API port also requires updating frontend/vite.config.js's proxy target. Atlas URI configuration is supported but live Atlas connectivity has not been tested.

## Authentication API

All endpoints below use /api/auth. Send JSON bodies and Authorization: Bearer <accessToken> for protected endpoints.

| Method | Path | Access | Request fields / behavior |
| --- | --- | --- | --- |
| GET | /registration-options | Public | Returns allowed signup roles and whether college demo signup is enabled |
| POST | /register | Public | name, email, password, role, optional phone; Member-only by default, all three roles with development demo opt-in; returns user and success message |
| POST | /login | Public | email, password, matching role; returns user, accessToken, tokenType, expiresIn |
| GET | /me | Authenticated | Returns the current safe user profile |
| PATCH | /me | Authenticated | Updates name and/or phone only |
| POST | /logout | Authenticated | Invalidates all of this user's existing tokens |
| POST | /change-password | Authenticated | currentPassword, newPassword; revokes all sessions |
| POST | /staff | Admin | name, email, password, role (admin/trainer), optional phone |
| POST | /forgot-password | Public | email; currently returns 503 because delivery is not configured |
| POST | /reset-password | Public | token, password; consumes a valid unexpired reset token |

Registration returns a safe user and a success message, then the frontend redirects to login. Only login returns a 15-minute access token. There is no refresh-token flow yet; users log in again after expiry. The frontend holds the access token in memory and sends it in Authorization headers. Refreshing or closing the page signs out this browser; tokens are never persisted to localStorage or sessionStorage. Logging out or changing/resetting the password revokes all previously issued tokens across devices. The middleware reads the current user from MongoDB on every protected request, so disabled/deleted accounts and current role changes are enforced.

Names are 2–80 characters. Emails are normalized to lowercase and indexed uniquely. Passwords must have at least 12 characters and at most 72 UTF-8 bytes; this avoids bcrypt's input truncation. bcrypt cost is 12. Roles, password hashes, reset tokens, token versions, and arbitrary properties cannot be changed through profile updates. Authentication responses use explicit public-field serialization and Cache-Control: no-store.

Limits per IP: 100 authentication requests per 15 minutes, 10 unsuccessful login/password-change attempts per 15 minutes, and 5 password-reset requests per 15 minutes. The current stores are process-local; use a shared rate-limit store before running multiple API instances. Proxy trust is intentionally not enabled; configure it for the actual trusted reverse proxy when deploying. Use HTTPS for deployment.

## First admin

Public registration creates members by default. The college demo opt-in (`NODE_ENV=development` and `DEMO_ROLE_REGISTRATION=true`) permits all three roles; production always stays Member-only. Run the one-time bootstrap locally with your chosen name, email, and password. No default admin account or fixed password has been created.

From backend in PowerShell:

```powershell
$env:ADMIN_NAME = Read-Host 'Admin name'
$env:ADMIN_EMAIL = Read-Host 'Admin email'
$adminPassword = Read-Host 'Admin password (12+ characters)' -AsSecureString
try {
  $env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $adminPassword).Password
  npm run create:admin
} finally {
  Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:ADMIN_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:ADMIN_NAME -ErrorAction SilentlyContinue
  Remove-Variable adminPassword
}
```

The script refuses when an admin already exists. Thereafter, an authenticated admin provisions staff through POST /api/auth/staff. Run bootstrap once from a trusted terminal; do not launch concurrent bootstrap processes. Admin/trainer/member business profile models will be added in their respective phases.

## Password-reset structure

Reset tokens are random 32-byte values; only their SHA-256 hashes and a 15-minute expiry are stored. Consumption is atomic and single-use, including simultaneous attempts. Resetting a password invalidates active JWTs. A delivery failure removes the token it issued.

Email delivery has not been connected. The forgot-password endpoint consistently returns 503 for known and unknown addresses, without creating a token or pretending an email was sent. The service accepts a future delivery adapter receiving { email, token, expiresInMinutes }; wire that adapter into the controller when email infrastructure is configured. Tokens are never returned by the public API or written to logs. Integration tests use a capture adapter exclusively inside the isolated test database.

## Verification

From backend:

```powershell
npm test
npm run test:integration
npm run check:db
```

The integration test uses a fresh, randomly named fittrack_test_* database on local MongoDB. It deletes only that database afterward and never writes to the application database. npm test covers input validation, authorization, configuration, health handling, and failed startup. npm run check:db is a separate read-only live database check.

Phase 3 results: 13 unit/HTTP/startup tests passed; 14 authentication integration scenarios passed (15 reported tests including the parent test). Coverage includes duplicate-email races, password hashing, role injection, staff permissions, NoSQL input rejection, JWT validation, current database roles, disabled/deleted users, profile protection, logout/password-change revocation, reset expiry and concurrent reuse, delivery failures, and rate limiting.

From frontend, run npm test and npm run build. Phase 4 verification passed all 11 frontend tests and the production build, plus all 13 backend tests and 14 authentication integration scenarios (15 reported tests including their parent). Vite's development proxy forwards /api to Express; production API routing remains a later deployment task.

## Architecture and dependencies

Frontend: components, pages, layouts, hooks, services, context, utils, styles. App.jsx composes the router and authentication provider. React Router defines public and role-protected routes; Axios handles API requests and session expiration. React/React DOM, Vite, and the React plugin are also installed.

Backend: models define data; validators allow only expected input; controllers map HTTP; services implement authentication; middleware handles identity, permissions, rate limits, and safe errors. app.js composes Express without opening a port; server.js validates configuration, connects MongoDB, ensures user email, membership-plan name, and session reservation indexes, and then starts HTTP. Shutdown closes both connections. Dependencies: Express, dotenv, Mongoose, bcrypt, jsonwebtoken, express-rate-limit.

The starting screen uses optional Google Fonts with sans-serif fallbacks and a CSS illustration. Its project-vision cards describe planned capabilities.

See STRUCTURE.md for the complete source tree and COMMANDS.md for commands and installation outcomes. Phases 1–19 are complete. Phase 20 (final optimization, documentation and GitHub preparation) is next, following the requested one-phase-at-a-time workflow. See PHASES.md for the complete development plan.

## Phase 4: frontend authentication and layouts

Public routes: /login, /register, /forgot-password, and /reset-password?token=... . Registration creates members by default and supports all three roles only with the development demo opt-in described in README.md. Each role has its own workspace at /admin, /trainer, or /member, with /profile and /security pages. Trainer and member overview cards describe upcoming modules. Admins see the live dashboard described below.

Guests are redirected to login and returned to an allowed page for their role after signing in. Unauthorized roles see an access-denied page. Unknown routes show a not-found page. Profile updates persist through the API. Password changes revoke sessions; incorrect current passwords preserve a still-valid session. Logout revokes all devices. Session expiry clears the in-memory identity, and stale API responses cannot overwrite a newer session.

Shared form components provide labels, password visibility, validation, loading, error and success messages. Layouts include desktop navigation, a mobile dialog, a skip link, and route announcements. Forgot-password clearly explains that email recovery is not configured; reset forms accept a valid token when delivery is configured later.

Browser checks covered protected-route redirection, member sign-in returning to the requested profile, profile saving, logout, and role workspaces. Registration and mobile profile/navigation were also exercised during the initial Phase 4 implementation. Password change/reset behavior is covered by API integration tests; no real account password was changed for browser verification.

## Phase 5: admin dashboard

Sign in as an administrator and visit /admin. GET /api/dashboard/admin requires a current, enabled admin account and returns Cache-Control: no-store. Guests receive 401; members and trainers receive 403. No new packages were needed.

The dashboard contains total members, enabled member accounts, trainer totals and enabled trainers, current-month registrations, a six-month registration chart, account status distribution, and the five newest member accounts. It supports manual refresh, loading, errors, retry, empty data, and mobile layouts. Charts include visible numeric labels; the recent-member table has a caption, column headers, and a keyboard-focusable horizontal scroll region.

Active accounts means User.active, not a paid or unexpired membership. Registrations are counts of currently existing member accounts by their creation date; they are not an immutable historical audit or a count of paid memberships. Months use UTC, include zero-count months, and end at the current partial month. Counts and recent-member rows reflect the current database; deleted or reassigned users no longer contribute as members. Recent-member fields are restricted to ID, name, email, active status, and creation date.

Membership statistics, revenue/recent payments, attendance, and upcoming sessions have explicit unavailable states. Their API module flags are false. These panels intentionally have no invented amounts, sessions, or membership statuses. Their data sources arrive in Phases 8, 9, 11, and 12. The current aggregate scans the account collection with a five-second query limit; revisit indexing/caching when measuring larger datasets.

Verification: all 13 backend unit/HTTP/startup tests, 11 frontend tests, and 18 integration scenarios passed (20 reported integration tests including two parent tests). New dashboard scenarios cover empty data, role/active counts, UTC month and year boundaries, future registration exclusion, zero filling, recent-member ordering/limits, response field restrictions, admin-only access, cache headers, role changes, and disabled accounts. Production build passed. Browser checks covered desktop and 390px mobile rendering, live data, access revocation removing displayed data, and successful retry after restoring access. The one temporary browser account and isolated integration databases were removed. Existing application records were preserved.

## Phase 6: member management

Administrators can open /admin/members to search by name, email, or phone, filter active/inactive/archived accounts, sort results, and paginate. They can create member accounts, edit account details, activate/deactivate accounts, and open member profiles. Coaching profiles support an active trainer assignment, fitness goals, and administrator-only notes. Previously assigned unavailable trainers remain visible and can be retained or cleared.

All /api/members endpoints require an enabled administrator and return Cache-Control: no-store:

| Method | Path | Behavior |
| --- | --- | --- |
| GET / POST | /api/members | List or create members |
| GET | /api/members/trainers | List available trainers |
| GET / PATCH | /api/members/:id | Read profile or update account |
| PATCH | /api/members/:id/profile | Update trainer, goals, and notes |
| DELETE | /api/members/:id | Archive, preserving the account and profile |
| POST | /api/members/:id/restore | Restore as inactive |

List parameters are q, status (all/active/inactive/archived), sort (newest/oldest/name), page, and limit (1–50). Search treats regular expression characters literally. All current members excludes archived accounts. Archived accounts also leave dashboard aggregates, retain their unique email, and cannot be edited until restored. Deactivation, archiving, and account email changes revoke existing sessions. Restoration does not reactivate access. Account status remains separate from paid membership status.

Membership, attendance, payment, workout, and progress history panels are marked Coming soon until those modules exist. No history records are fabricated. The Member model extends User with an optional profile sharing the account ID.

Verification on September 26, 2026: 11 frontend tests, 13 backend tests, and 26 integration scenarios passed (29 reported integration results including parent tests); the production build passed. The first backend run had a startup-test timeout; the full backend unit suite passed on rerun without code changes. Member integration coverage includes permissions on every endpoint, password hashing, unique email validation, literal search, pagination, protected fields, trainer eligibility, session revocation, and archive/restore retention. The preceding interrupted task verified browser search, editing, trainer assignment, and archive/restore and fixed the trainer dropdown loading state. Mobile inspection was started there but its final verification was not recorded; it was not repeated during this continuation. All three exact temporary browser accounts and their associated profiles were removed; integration suites removed their isolated databases.

## Phase 7: trainer management

Administrators can open /admin/trainers to add trainers, search name/email/phone, filter account status, sort, and paginate. Trainer detail pages support account editing, activation/deactivation, archiving/restoration, professional profiles, and paginated assigned-member links. Member assignment remains managed from the member profile.

Professional profiles store up to 10 specializations, whole years of experience (0–80), a biography, a validated time zone, and up to 28 weekly working-hour intervals. Days use 0=Sunday through 6=Saturday and times use HH:mm. Intervals must start before they end on the same day; overlaps are rejected and adjacent intervals are allowed. Empty availability means no published hours. Time-zone aliases may be normalized by Node's Intl implementation. These are recurring local working hours, not bookable slots or reservations. Date-specific schedules, daylight-saving booking rules, and conflict prevention belong to Phase 9.

The Trainer model extends User with the same account ID. Existing trainer accounts created through the staff API work without a profile; their profile is created on first save. Account creation through this module always creates a trainer and rejects supplied roles. All endpoints below require a current enabled administrator and disable response caching:

| Method | Path | Behavior |
| --- | --- | --- |
| GET / POST | /api/trainers | List or create trainer accounts |
| GET / PATCH | /api/trainers/:id | Read profile/workload or update account |
| PATCH | /api/trainers/:id/profile | Save professional profile and weekly hours |
| GET | /api/trainers/:id/members | Paginated assigned-member accounts |
| DELETE | /api/trainers/:id | Archive account, retaining profile and assignments |
| POST | /api/trainers/:id/restore | Restore as inactive |

Lists accept q, status, sort, page, and limit with the same validation as member lists. Workload counts current, non-archived member assignments and active assigned accounts. Archived trainers leave the directory and dashboard totals. Inactive/archived trainers cannot sign in or receive new assignments; previous assignments remain visible for administrators to reassign. Deactivation, archiving, and email updates revoke tokens. Restoration requires a separate activation step. Session schedules and performance metrics are explicitly unavailable until session data exists; no session statistics are fabricated. Trainer self-service professional-profile editing is not included in this phase.

Verification: 13 backend unit/HTTP/startup tests, 11 frontend tests, and 34 integration scenarios passed (38 reported integration results including parent tests). Eight new trainer scenarios cover permissions across all endpoints, role injection, hashing, duplicates, search, pagination, validation, interval overlap and boundaries, profile persistence, workload filtering, session revocation, assignment eligibility, and archive/restore retention. The final production build passed. Browser checks covered trainer search, saved specializations/experience/biography/hours, overlap error and recovery, live assigned-member counts, mobile profile and interval controls at 390px, and a regression check saving a member account through the reused form. The temporary viewport was reset. Exactly three Phase 7 test accounts and associated profiles were removed; existing records were preserved.

## Phase 8: membership management

Admins manage plans at /admin/membership-plans, review coverage at /admin/memberships, and enroll or renew through member profiles. Members can read their own coverage and history at /member/membership. Plans support names, duration (1–3660 whole days), prices in INR stored as integer paise (0–100000000), up to 20 features, and active/inactive availability. Names are unique after trimming and lowercasing; startup creates the unique index before accepting traffic.

Coverage stores a snapshot of the plan's name, price, duration, and features. Editing or disabling a plan preserves previously recorded periods. Initial enrollment starts today or later in UTC; expiry is exclusive at 00:00 UTC after the selected number of days. Renewal starts at the later of today's UTC date or the end of the latest period. Expiry is calculated when data is read; no scheduled job is needed. Coverage status is separate from account access and payment. No payment is collected or confirmed in this phase.

Concurrent enrollment creates one record per member. Renewals require expectedVersion and atomically append only if that version is current; stale requests return 409. History is limited to 200 periods. Only enabled, non-archived member accounts can receive coverage. Archived accounts retain history but are excluded from coverage directory/dashboard totals. Coverage cannot currently be canceled, refunded, or edited.

All /api/memberships responses disable caching. Admin-only endpoints:

| Method | Path | Behavior |
| --- | --- | --- |
| GET / POST | /api/memberships/plans | List or create plans |
| PATCH | /api/memberships/plans/:id | Edit plan or availability |
| GET | /api/memberships | Search and filter coverage |
| GET / POST | /api/memberships/members/:id | Read coverage or enroll |
| POST | /api/memberships/members/:id/renew | Append a renewal |

GET /api/memberships/me requires a member role and reads only the authenticated member. Lists accept q, status, page, and limit (1–50). Coverage statuses are all/active/scheduled/expired; plan statuses are all/active/inactive. Members with no enrollment are not in the coverage directory.

Verification on September 28, 2026: 12 frontend tests, 13 backend tests, and 44 integration scenarios passed (49 integration results including parent tests); production build passed. New membership scenarios cover permissions, plan validation and uniqueness, calendar boundaries, enrollment/renewal concurrency, immutable snapshots, exact expiry, inactive accounts/plans, scoped self-service, and dashboard/directory totals. The startup test initially hit its 12-second deadline under load and passed alone and on rerun; its watchdog now allows 30 seconds for cold Windows module loading while retaining the same exit and credential-redaction assertions. The full backend suite passed after this change.

Browser checks verified plan editing, preserved historical pricing, membership directory, renewal preview/save, and readable coverage/history at 390px. Member self-service was verified by integration tests, not by browser in this continuation. The viewport was reset. Removed exactly the two recorded Phase 8 fixture accounts, their membership/profile records, and their single test plan after checking no other member referenced it. Existing application records were preserved. Screenshot: phase8-mobile.png. Phase 9 has not started.

## Phase 9: one-to-one session scheduling

All roles have a Sessions page at /admin/sessions, /trainer/sessions, or /member/sessions. Admins can book for any active member, reschedule, cancel future sessions, and mark ended sessions completed. Members book and reschedule their own sessions, and can cancel before start. Trainers see only their sessions, can cancel before start, and mark sessions completed after end. Members cannot mark completion; trainers cannot create or reschedule bookings. Admin member/trainer profiles link to filtered schedules. The dashboard shows up to five upcoming or in-progress scheduled sessions.

Bookings are one-to-one, 15–180 minutes in 15-minute steps, on UTC quarter-hour boundaries, within the next 180 days. The date picker uses the trainer's published time zone, and available times include UTC offsets. A booking must fit entirely within one published weekly interval, without crossing midnight or a daylight-saving clock change, and the member's coverage must span the whole session without gaps. Repeated daylight-saving times are separate UTC instants; non-existent local times are never offered. Weekly-hour changes affect new bookings and reschedules. No recurring bookings, group capacity, day-specific exceptions, reminders, no-show status, or payments are included.

A session stores both participants and their occupied 15-minute blocks in a single document. A unique partial multikey index over reservations for scheduled sessions rejects overlapping trainer OR member reservations, including concurrent requests and partial overlaps. Rescheduling replaces the time and reservation keys in one atomic version-checked update; failed changes preserve the original booking. Cancellation atomically changes status and releases keys. This works with the existing standalone MongoDB; no transaction/replica-set setup is required. Startup builds indexes before accepting traffic.

Names and time zone are saved on booking (time zone refreshed when rescheduling). Disabling/archiving an account or editing hours does not automatically move or cancel existing bookings; admins can review and cancel future sessions explicitly. Account/profile eligibility and coverage are checked when booking or rescheduling. Completed/cancelled records remain in history. A past scheduled session stays scheduled until an admin or its trainer confirms completion; completion is separate from attendance tracking. Session records retain the latest schedule and actor/version metadata, not a full log of each reschedule.

All endpoints require authentication and return Cache-Control: no-store:

| Method | Path | Access / behavior |
| --- | --- | --- |
| GET | /api/sessions | Admin: all; trainer/member: own schedule |
| GET | /api/sessions/trainers | Admin/member: paginated active trainers with published hours |
| GET | /api/sessions/slots | Admin/member: available times constrained by account, coverage, hours, and conflicts |
| POST | /api/sessions | Admin/member: book; members cannot supply another member ID |
| PATCH | /api/sessions/:id | Admin/member owner: reschedule a future session |
| POST | /api/sessions/:id/cancel | Admin or either participant: cancel before start |
| POST | /api/sessions/:id/complete | Admin/trainer owner: complete after end |

List filters: from and to are UTC dates (from inclusive, to exclusive; maximum 366 days), status is all/scheduled/cancelled/completed, page returns 10 records. Defaults are today through 30 days later. Admins may also supply trainerId or memberId. Trainer search accepts q and page. Slots require trainerId, date in trainer time zone, durationMinutes, and memberId for admins; excludeId may refer only to an authorized session with matching participants. Creation takes trainerId, startAt as a canonical UTC ISO string, durationMinutes, and memberId for admins. Rescheduling takes startAt, durationMinutes, expectedVersion. Cancellation/completion take expectedVersion. Stale edits or booking conflicts return 409; unrelated session IDs return 404.

Verification: 13 backend tests, 12 frontend tests, and 55 integration scenarios passed (61 integration results including parent tests), plus production build. Eleven new session scenarios cover strict validation, role/owner permissions, active accounts, published hours, coverage gaps and exact boundaries, booking horizon, concurrent conflicts, adjacency, atomic reschedule failure, stale edits, cancellation release, completion timing, UTC offsets and daylight-saving transitions. Browser verification includes member booking, rescheduling, cancellation/history, and 390px mobile layout. Screenshot: phase9-mobile.png.

Completion on September 29, 2026: all above tests and the production build passed again. Removed exactly three recorded test accounts, their associated profiles/coverage, and one fixture session after identity and participant checks. Admin browser verification was interrupted in the earlier run; admin/trainer authorization is verified by integration tests. Phase 10 has not started.

## Phase 10: workout management

Admins and trainers use /admin/workouts and /trainer/workouts, with /plans and /exercises subsections. Members use /member/workouts. Each role can open an authorized assignment at /workouts/assignments/:id beneath its workspace. Admin member profiles link to filtered workout history.

Exercise definitions contain a name and technique instructions. Plans contain a name, instructions, and 1–50 ordered exercise entries. Each entry includes an exercise reference and saved name/instructions, workout day (1–7), sets (1–50), reps (1–1000) and/or duration per set (1–7200 seconds), rest between sets (0–3600 seconds), and entry-specific instructions. Days are numbered workout days, not calendar dates. Each assignment represents one cycle; recurring programs and per-set logs are not included.

Trainers create and edit their own exercise definitions and plans, and assign plans only to currently assigned active, non-archived members. Admins can inspect/edit any library record and assign any active plan to any eligible member. Plan exercises belong to the plan creator. Admin edits retain that ownership, and the editor filters exercise choices accordingly. Inactive exercises cannot be added to new plans; existing entries can retain saved definitions when a plan is edited or disabled. Existing plans remain assignable until the plan itself is disabled.

Assignment copies the current plan and exercise details into an immutable snapshot, preserving history through library edits. Account and plan eligibility are checked when assignment is requested; later changes do not retroactively alter assigned workouts. Names are saved at assignment time. Workout access does not require membership coverage. An assignment stores its source plan version, assigning staff account, creation/update times, progress, and archival metadata. It does not store a full audit trail for each completion toggle.

Members read only their own assignments and mark individual exercise entries complete or undo completion after completing all sets. Overall completion is derived from the count of completed entries. Trainers can see progress for their currently assigned members, including earlier workouts assigned by another trainer. Reassigning a member removes the previous trainer's access on subsequent requests. Admins see all assignments. Only the member changes completion; staff can archive an assignment, preserving its progress and disabling further changes. Archive the previous cycle before assigning the same plan to the same member again.

Exercise/plan edits, completion changes, and archiving require expectedVersion and use atomic version-checked writes; stale edits return 409. A unique partial database index on planId/memberId for non-archived assignments prevents duplicate concurrent assignments. All workout indexes are created before server startup accepts traffic. Assignment and completion operate on standalone MongoDB without transactions.

All workout endpoints require authentication and return Cache-Control: no-store:

| Method | Path beneath /api/workouts | Access / behavior |
| --- | --- | --- |
| GET / POST | /exercises | Admin/trainer: list or create definitions |
| PUT | /exercises/:id | Admin/owner: replace editable fields using expectedVersion |
| GET / POST | /plans | Admin/trainer: list or create plans |
| PUT | /plans/:id | Admin/owner: replace name, instructions, entries and availability |
| GET | /members | Admin: eligible members; trainer: own eligible assigned members |
| POST | /plans/:id/assign | Admin/owner: memberId and expectedVersion of the plan |
| GET | /assignments | Role-scoped paginated assignment summaries |
| GET | /assignments/:id | Authorized assignment details and saved exercise entries |
| PATCH | /assignments/:id/completion | Member owner: itemIndex, completed boolean, expectedVersion |
| POST | /assignments/:id/archive | Admin/current assigned trainer: expectedVersion |

Lists support literal name search q and page (10 records, newest first). Library status is active/inactive/all; assignment status is active/completed/archived/all. Default status is active. Admins/trainers may filter assignments by memberId; members cannot select another account. Admin exercise lists support ownerId for plan editing. Member picker results contain only ID and name. Unsupported fields, operator objects, invalid IDs and out-of-range values return 400. Unauthorized record IDs return 404; disallowed roles return 403.

Verification on September 29, 2026: 13 backend tests, 12 frontend tests, and 66 integration scenarios passed (73 integration results including parent tests), for 98 reported results. Production build passed. Eleven new workout scenarios cover input limits, role/owner scopes, pagination, literal search, active-member eligibility, duplicate assignment races, immutable snapshots, completion conflicts/undo, trainer reassignment, archival history, and repeat cycles.

Browser checks verified trainer exercise creation, a two-day plan using reps and duration, assignment to the trainer's member, member completion, trainer progress visibility, and archival with retained completion. Mobile check at 390px found no horizontal overflow; screenshot: phase10-mobile.png. Viewport override reset. Removed exactly three temporary accounts, one member profile, one exercise, one plan, and one assignment after identity/reference checks. Existing records were preserved. No dependencies installed. Phase 11 has not started.

## Phase 11: attendance

Members use /member/attendance to check in and view their attendance percentage and paginated history. Admins use /admin/attendance for history and /admin/attendance/report for member reports and check-ins on behalf of members. Admin member profiles link to filtered attendance history; the admin dashboard displays today's and this month's recorded visits.

Check-ins use the server timestamp and UTC calendar date. A unique member/day index, created before startup accepts traffic, permits one visit per UTC day even with concurrent requests. Active, non-archived members can check in regardless of membership coverage. Trainer access is denied. Members can read and create only their own records; admins can view retained history and reports for inactive and archived members. Records preserve the member name at check-in and the recording account; history search uses the saved name, while report search uses the current name. No editing, deletion, or backdating endpoint is provided.

Attendance percentage is checked-in days divided by calendar days in the inclusive selected period, beginning no earlier than the member's UTC registration date, rounded to one decimal place. Today counts as a calendar day. Rest days and days without membership coverage count in the denominator. A period entirely before registration has no percentage. Reports include members with zero visits who registered by the end of the period.

All attendance endpoints require authentication and return Cache-Control: no-store:

| Method | Path | Behavior |
| --- | --- | --- |
| GET | /api/attendance | Member's own history or admin history; includes summary when scoped to one member |
| GET | /api/attendance/report | Admin-only paginated member percentages |
| POST | /api/attendance/check-in | Member sends {}; admin sends memberId; duplicate day returns 409 |

History/report filters accept from and to as inclusive YYYY-MM-DD UTC dates, defaulting to month start through today. Maximum period: 366 days; future dates are rejected. page selects 10 records. Admins can also supply memberId and literal name search q. Unsupported fields and malformed IDs, dates, and queries return 400.

Verification on September 29, 2026: 13 backend tests, 12 frontend tests, and 83 integration results (75 scenarios plus 8 parent tests) passed, along with the production build. Nine attendance integration scenarios cover permissions, strict input validation, concurrent duplicate requests, account eligibility, UTC midnight, registration and leap-day boundaries, zero-visit reports, retained history, pagination, and private-field exclusion. Browser interaction and mobile visual verification for this phase have not been performed. No dependencies were added. Phase 12 has not started.


## Phase 12: simulated payments

Members use /member/payments for their own enrollment and renewal payments. Admins use /admin/payments, with member profiles linking to a memberId-filtered view. Trainers cannot access payments. Demo mode is prominently labelled: no real money is collected and payment status does not change membership coverage.

Opening a saved membership period creates one pending payment or returns its existing record. The amount, currency, plan name, and coverage dates are copied from the saved enrollment price. A unique member/period index prevents duplicate concurrent charges. Pending payments can simulate success or failure; failed payments can retry to pending. Paid payments are immutable. Mutations require an active, non-archived member, expectedVersion for transitions, and atomic version checks. History is retained for inactive and archived members. Each payment retains up to 100 status events; further transitions are rejected at the limit.

All /api/payments endpoints require authentication and return Cache-Control: no-store:

| Method | Path | Behavior |
| --- | --- | --- |
| GET | / | Role-scoped history; page and status filters; admins also accept memberId and literal member-name search q |
| POST | / | Open payment using periodId; admins must also supply memberId |
| POST | /:id/simulate | expectedVersion and outcome (paid or failed) |
| POST | /:id/retry | expectedVersion; failed to pending |

History pages contain 10 records. The admin dashboard shows simulated paid totals for all time and the current UTC month, plus five recent records. Revenue includes retained history for inactive and archived members. This phase has no payment gateway, real transactions, refunds, or downloadable invoices.

Verification: the implementation run passed 13 backend tests, 12 frontend tests, 93 integration results, and the production build. Completion browser verification on September 29, 2026 used a separate randomly named test database and confirmed pending → failed → pending → paid, all four history events, saved ₹1,499.00 pricing, and removal of mutation controls after payment. Screenshot: phase12-payments.png. Admin revenue and authorization are covered by integration tests; admin browser and mobile checks were not performed. Phase 13 has not started.


## Phase 13: fitness progress tracking

All roles have a Fitness progress navigation link at /member/progress, /trainer/progress, or /admin/progress. Members are identified automatically from their session. Admins and trainers select an active member using the existing searchable, paginated member picker; trainers see only currently assigned members. Admin member profiles also link to progress, including retained history for inactive/archived accounts.

Members and admins can create and correct one measurement entry per member per UTC date. Trainers have read-only access to currently assigned members; reassignment removes the old trainer's access on subsequent requests. Inactive and archived member history remains visible to authorized staff, but cannot be changed. Membership coverage is not required.

Weight (kg) is required, from 1 to 500. Optional height is 30–250 cm; optional waist, chest, and hips are 1–300 cm. Numbers permit one decimal place. These are application input bounds, not recommended measurements. Notes allow 2,000 characters. Dates may predate registration but must be valid dates from 1900 through today (UTC). The server calculates BMI as weight in kg divided by height in metres squared, rounded to one decimal place, using only the height stored in that entry. Omitted height produces no BMI. There are no BMI categories or health recommendations.

A unique member/date index is created before startup accepts traffic. Edits replace the entry fields and require expectedVersion; atomic version checks reject stale edits with 409. Moving an entry onto an occupied date also returns 409. Records retain creation/update timestamps, original recording account, latest editing account, and revision number. Earlier revision contents are not retained; there is no delete endpoint.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | /api/progress/members/:memberId | Own member, admin, or assigned trainer: history, summary, trend points, and workout completion |
| POST | /api/progress/members/:memberId | Own member or admin: day, weightKg, optional heightCm/waistCm/chestCm/hipsCm and notes |
| PUT | /api/progress/members/:memberId/:id | Own member or admin: replace fields plus expectedVersion |

All endpoints require authentication and send Cache-Control: no-store. Unsupported fields, malformed IDs, and invalid dates/numbers return 400; unrelated member/entry IDs return 404; trainers cannot mutate records (403).

History accepts from, to (inclusive UTC dates) and page. The default window is the 90 days ending today, or ending at an explicitly supplied to date. Maximum window: 366 days. History is newest first, 10 entries per page. Summary and chart data cover the entire window independently of pagination. Saving an entry switches to a 90-day window ending on its date. Weight change compares the first and last entry in the window; latest BMI belongs to the latest entry rather than silently falling back to an older height.

SVG charts support weight, BMI, waist, chest, and hips, use elapsed-date spacing, omit missing values, and connect recorded observations. An expandable table provides exact values. Workout completion is the current completed-exercise count divided by total exercise entries across workouts assigned in the selected period, including archived assignments. It is not completion activity on each calendar day and does not fabricate a daily workout history.

Verification on September 29, 2026: 13 backend tests, 15 frontend tests, and 102 integration results (92 scenarios plus 10 parent tests) passed. Eight progress scenarios cover role/ownership boundaries, trainer reassignment, numeric/calendar limits, BMI, concurrent create/edit conflicts, pagination-independent trends, workout date boundaries, and retained read-only history. Frontend tests cover form payloads and chart behavior for empty, missing, constant, single, and unevenly dated values. Production build passed. No dependencies added. Phase 14 (notifications) has not started.


Browser verification: member creation and correction of a progress entry, recalculated BMI and weight change, saved notes/revision, BMI chart selection and accessible values table, trainer member selection and read-only history all passed. A 390px viewport check showed no horizontal overflow (375px content width including scrollbar allowance). Increased mobile chart label size and panel spacing, rebuilt successfully, and verified final styling. Saved phase13-progress.png and phase13-mobile.png; viewport reset and test tab closed. Admin mutation authorization was verified in integration tests; admin browser flow was not separately exercised.

## Phase 14: notifications

The header bell and Notifications navigation open /member/notifications, /trainer/notifications, or /admin/notifications. Members receive all five categories; trainers receive updates and reminders for their own sessions. Admins have an empty personal inbox and continue to use the admin dashboard for oversight. No role can access another account's inbox.

Booking updates reflect the latest session version within the past 30 days. Session reminders appear during the 24 hours before a scheduled start and disappear at its start or after cancellation. Membership reminders cover the last seven days of continuous coverage, merging adjoining renewals, and the first seven days after expiry when there is no current coverage. Pending or failed simulated payments generate reminders that disappear when paid. Workout assignment and archive updates cover the past 30 days; exercise completion does not generate a notification.

The inbox provides read/unread and category filters, ten items per page, newest first, explicit mark-read/mark-unread controls, and links to the relevant feature. Opening a link does not mark a notification read. The global unread total is independent of filters. Read state persists per account and notification event; repeated refreshes and concurrent requests do not duplicate an event.

Notifications reconcile from current source records on API access. The visible app refreshes every 60 seconds, on return/focus and navigation, and through Refresh inbox. Superseded updates and resolved reminders disappear from the current inbox. This is an in-app current-state view, not a complete event audit: intermediate changes and reminder windows may be missed while offline. No email, push delivery, background scheduler, or OS notification permission is involved.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | /api/notifications | Own inbox; optional page, status (all/unread/read), and kind filters |
| GET | /api/notifications/unread | Own current unread count; no query parameters |
| PATCH | /api/notifications/:id/read | Own eligible notification; exact body {"read": true} or {"read": false}; no query parameters |

All endpoints require authentication and send Cache-Control: no-store. Unexpected query/body fields and malformed IDs return 400; unavailable or unrelated notification IDs return 404. A unique recipient/key index enforces deduplication. Expiring event rows use MongoDB TTL cleanup; current eligibility hides them at the deadline even before asynchronous deletion. Payment notification rows have no TTL, retaining read state while current eligibility controls visibility.

Verification: 13 backend tests, 15 frontend tests, and 111 integration results (100 scenarios plus 11 parent tests) passed, as did the production build. Notification coverage includes concurrent synchronization, ownership, validation, persistent read state, role links, pagination, time boundaries, renewals, and source-state changes. No dependencies were added.

Browser verification completed September 30, 2026: all five categories, read-state badge updates, read filter, workout detail link, and disappearance of a paid demo payment reminder passed. The 390px mobile viewport had no horizontal overflow (375px content width). Screenshots: phase14-notifications.png and phase14-mobile.png. Trainer/admin UI flows were not separately exercised; role behavior is covered by integration tests. The temporary browser server and its isolated database were cleaned up. Phase 15 (analytics and charts) is next.

## Phase 15: analytics and charts

Admins can open /admin/analytics from the Analytics navigation link. GET /api/analytics provides the same report to authenticated admins only, with Cache-Control: no-store. It accepts from and to (inclusive YYYY-MM-DD UTC dates), and interval (day or month). The default is the last 90 days grouped monthly; at most 366 days are allowed, ending no later than today. Unknown fields, duplicate parameters, invalid calendar dates, and unsupported intervals return 400. Members and trainers cannot access organization analytics.

Summary cards show member registrations, recorded check-ins, unique visitors across the whole period, and simulated INR revenue. The selectable horizontal bar chart shows registrations, check-ins, revenue, or scheduled/completed/cancelled sessions. Missing periods are zero-filled. An expandable, horizontally scrollable table provides exact values for every measure and paid-payment counts. Refresh, loading/error states, empty results, and URL-backed date filters are supported.

Registrations use createdAt and include retained inactive/archived member accounts; this differs from the dashboard's current-account registration chart, which excludes archived accounts. Visits use checkedInAt; unique visitors are distinct member IDs across the entire date window, not a sum of daily unique counts. Revenue sums amountMinor only for successful simulated INR payments by paidAt, excluding pending/failed records. No real money is collected. Sessions use startAt and their current status. Future starts are excluded, and status changes or rescheduling can change historical totals. Session completion is not an attendance rate. Attendance, payments, and sessions include retained history for inactive/archived accounts.

Today's data is capped at request time; first/last monthly buckets can be partial. Collection aggregates are separate live reads rather than a transactional snapshot. These are operational analytics, not immutable financial accounts. Personal measurement trends remain in Fitness progress. Added role/creation-date and check-in/member indexes support the reporting queries; normal startup creates them. No dependencies added.

Verification: 13 backend tests, 15 frontend tests, 116 integration results (104 scenarios plus 12 parents), and the production build passed. Four new analytics scenarios cover empty periods, daily/monthly agreement, exact UTC/time boundaries, retained history, distinct visitors, payment exclusions, input validation, privacy and admin authorization. The focused suite passed again after adding query indexes. Browser verification covered populated monthly revenue versus the exact-value table and a daily range with no revenue.


Final browser checks on September 30, 2026: daily grouping and empty revenue state passed; monthly chart amounts matched the exact-value table. Refined filter styling and made summary cards single-column on narrow screens to prevent broken currency values. Final 390px viewport check had equal document and scroll widths of 375px. Saved phase15-analytics.png and phase15-mobile.png. Phase 16 (responsive UI and UX improvements) is next.



## Phase 16: responsive UI and UX improvements

Added shared responsive.css refinements for 16px mobile form text, 44px button targets, wrapping filter actions and long text, narrow workout/trainer grids, single-column mobile metric cards, and compact analytics bars. Wide tables remain locally scrollable. Keyboard focus outlines cover controls and regions, progress values have a named keyboard-focusable region, and reduced-motion preferences suppress transitions and animations.

Mobile workspace navigation has an accessible dialog name, controls/expanded semantics, background scroll locking, native Escape dismissal, and automatic closure when resizing past 800px. Main content is a focusable skip-link target and receives focus on workspace route changes.

Verification on September 30, 2026: all 15 frontend tests and production build passed; rebuilt after correcting a mobile font specificity conflict. Browser checks covered 320px dashboard and analytics without page overflow, 390px navigation, Escape focus restoration, route navigation, desktop resize dismissal, and analytics at 768px and 1024px. Final 320px inputs computed to 16px; the exact-values table retained local scrolling. Screenshot: phase16-mobile.png. Checks used the isolated analytics fixture; other role-specific forms and physical mobile devices were not separately exercised. No dependencies added or backend logic changed. Phase 17 is next.


## Phase 17: validation, security and error handling

API response protections now run before JSON parsing, covering successful responses, authentication failures, unknown API paths and rejected bodies. All /api responses receive Cache-Control: no-store, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy: no-referrer and a restrictive content security policy for API responses. These headers do not configure the separately hosted frontend document; production frontend headers and HTTPS remain deployment responsibilities.

Nonempty API request bodies require application/json. JSON parsing retains its 100kb limit and now refuses compressed bodies. Malformed JSON returns 400; oversized bodies return 413; unsupported media types, charsets and compression return 415. Bodyless actions such as logout remain supported. No new cross-origin access or proxy trust is enabled.

Error handling distinguishes email duplicates from other record conflicts, sanitizes model validation/cast errors and malformed route paths, and delegates errors after response headers are sent. Raw bodies, database details and stack traces are not returned. The frontend only displays nonempty string error messages up to 500 characters, using a safe fallback for unexpected response shapes.

Verification: 18 backend unit/HTTP/startup tests, 116 integration results (104 scenarios plus 12 parents), 16 frontend tests and the production build passed. New coverage exercises response protections, parser rejection paths, sanitized conflicts and errors, headers-sent delegation and malformed frontend error payloads. Existing integration coverage rechecked role and ownership restrictions, token tampering/expiry/revocation, injection rejection, login rate limits and concurrency. No dependencies added. This is application hardening, not a deployment security audit; rate limiting still uses process-local stores and password-reset delivery remains unconfigured. Phase 18 is next.


## Phase 18: testing and bug fixing

Reproduced and fixed three session-store regressions: accepting malformed identity fields, obsolete expiry callbacks clearing a replacement login, and unrelated/invalid profile responses replacing the authenticated user. Session expiry now uses a generation guard; identities require nonempty string IDs/names and supported roles; profile updates must match the current user and token. Lifetimes exceeding the JavaScript timer range are rejected. Valid role changes remain supported.

Added five frontend regressions, including delayed unauthorized responses, server failures and request cancellation. Final results: 21 frontend tests, 18 backend tests, 116 integration results (104 scenarios plus 12 parents), and the production build passed. See TESTING.md for red-before/green-after evidence, scope and remaining test limitations. No dependencies added. Phase 19 (demo/sample data) is next.


## Phase 19: demo/sample data

See DEMO.md for the prepared local showcase, active account emails, private password-file location and launch commands. npm run seed:demo creates role-based sample data only in a dedicated local fittrack_demo database (or permitted suffix). It refuses unrelated nonempty data and preserves completed seed runs without changing edits or passwords. Failed/incomplete runs require a fresh database suffix; no reset or deletion is performed.

Includes memberships, simulated payments, availability and reserved sessions, attendance, progress, workout completion, inactive/archived members and naturally derived notifications. Seven new integration results passed; full suite now has 123 passing results. All three prepared roles passed real HTTP login and feature-read checks. No dependencies added. The normal application database and .env were preserved. Phase 20 is next.


