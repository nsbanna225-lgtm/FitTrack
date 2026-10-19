# FitTrack

A fitness management web app built with React, Vite, Express and MongoDB. Separate admin, trainer and member workspaces support memberships, session bookings, workout assignments, attendance, progress charts, in-app notifications and operational analytics. Payments are simulated.

## Quick start

Requirements: Node.js 22.12+ (Node 24 used for local verification), npm and MongoDB running at 127.0.0.1:27017.

From the FitTrack directory:

```powershell
npm ci --prefix backend
npm ci --prefix frontend
```

Create backend/.env from backend/.env.example if it does not exist. Keep the default local MongoDB URI or set your own. Generate the JWT secret from a PowerShell terminal in backend:

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

Start the API and frontend in separate terminals from FitTrack:

```powershell
npm run dev --prefix backend
```

```powershell
npm run dev --prefix frontend
```

Open [FitTrack locally](http://127.0.0.1:5173). The API uses port 5000; Vite proxies /api to it. GET /api/health checks liveness and GET /api/ready checks MongoDB connectivity. Process environment variables override backend/.env.

For a populated local demonstration, follow [DEMO.md](DEMO.md). It covers all roles and uses a separate database. By default, public registration creates members; provision the first admin using the secure prompt workflow under First admin in [FEATURES.md](FEATURES.md).

### College demo registration

To create accounts with your own email addresses for a local college demo, set `NODE_ENV=development` and `DEMO_ROLE_REGISTRATION=true` in `backend/.env`, then restart the backend. The registration page reads the allowed roles from `/api/auth/registration-options` and offers Member, Trainer and Admin. The local configuration has this demo option enabled. `.env.example` keeps it disabled by default.

Enter a full name, a unique valid email, a password of at least 12 characters (maximum 72 UTF-8 bytes), matching confirmation and a role. Registration saves that role with the existing bcrypt hash and redirects to `/login` with “Account created successfully. Please sign in.” It does not sign in automatically. Log in with the matching role to reach `/member`, `/trainer` or `/admin`. Selecting a different role at login is rejected and never changes the account. Existing emails cannot be registered again or promoted through registration.

This role self-selection is development/demo behavior only. Setting the flag to `false`, or using any `NODE_ENV` other than `development`, restores Member-only registration at the API and UI. Production ignores the demo opt-in. Existing JWT, profile restrictions and protected-route checks still use the database role. No personal email is hard-coded.

## Verification

```powershell
npm test --prefix backend
npm run test:integration --prefix backend
npm test --prefix frontend
npm run build --prefix frontend
```

Integration tests require local MongoDB and use disposable randomly named databases. GitHub Actions runs the same checks with a MongoDB service; the workflow has been prepared but has not yet run on GitHub.

## Project guide

| Document | Contents |
| --- | --- |
| [FEATURES.md](FEATURES.md) | Detailed behavior, API contracts and historical phase notes |
| [DEMO.md](DEMO.md) | Sample accounts, isolated seeding and demo walkthrough |
| [TESTING.md](TESTING.md) | Regression evidence and test limitations |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production build and hosting requirements |
| [PUBLISHING.md](PUBLISHING.md) | Local Git and GitHub preparation |
| [STRUCTURE.md](STRUCTURE.md) | Source layout |
| [PHASES.md](PHASES.md) | Development milestones |
| [COMMANDS.md](COMMANDS.md) | Historical execution and verification record |

## Practical limits

- Payments are simulations; no payment processor is connected.
- Password-reset delivery is not configured and returns 503. Reset-token logic is tested through a test adapter.
- Tokens stay in memory for 15 minutes. Reloading signs out; no refresh-token flow exists.
- Notifications reconcile on API access; no email, push or background scheduler is configured.
- Login limits are process-local. Multiple instances require a shared limiter store.
- Atlas connectivity, production hosting, load and physical-device testing are not verified.
- Demo credentials and application environment files are local-only and ignored by Git.

All 20 development phases are complete locally. GitHub publication and production deployment have not been performed.

## Legacy local database startup recovery

The September 30 startup repair preserves the existing `fittrack` database. Legacy attendance,
payment and notification documents omit the current unique-index keys. Their current indexes
now enforce uniqueness only when those keys have the expected types. Startup logs include the
failing stage, error stack, code and cause, with MongoDB URIs and the JWT secret redacted.
Current payment views exclude legacy-format records so the admin dashboard can render.

Two explicit migration scripts are available from `backend` (dry-run unless `--apply` is supplied):

```powershell
node scripts/migrate-legacy-users.js
node scripts/migrate-legacy-indexes.js
```

The user migration copies existing bcrypt hashes to `passwordHash` and supplies missing account
defaults; passwords, roles, IDs and original fields are retained. The index migration builds
partial legacy indexes before removing the old unique indexes on `members.memberId`,
`trainers.email`, `memberships.name` and `payments.paymentId`. This preserves legacy string-value
uniqueness while permitting current documents that omit those old fields. Neither script runs
automatically at startup or deletes records or collections.

Both migrations were already applied to the local `fittrack` database on September 30, 2026.
All six original users, 33 attendance records, 13 payments and five notifications remain.
Legacy attendance/payment/notification records are preserved but are not converted into current
history or totals; that requires a separately reviewed mapping of the older fields.
No database cleanup or migration rerun is required for this repaired local database.
