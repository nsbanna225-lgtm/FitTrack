# Source structure

Use FitTrack as the repository root. Generated output, installed dependencies and local secrets are excluded from publishing.

```text
FitTrack/
  .github/workflows/verify.yml   CI: tests, MongoDB integration and frontend build
  backend/
    .env.example                Public environment template
    integration/                Database-backed feature and demo tests
    scripts/                    Admin bootstrap, database check, demo seeder, UI fixtures
    src/
      config/                   Environment and MongoDB connection
      controllers/              HTTP request/response mapping
      middleware/               Authentication, roles, limits, API boundary and errors
      models/                   Mongoose schemas and indexes
      routes/                   Feature routes
      services/                 Business rules and data access
      utils/                    Shared backend utilities
      validators/               Strict request validation
      app.js                    Express app without opening a listener
      server.js                 Validated startup, indexes and shutdown
    tests/                      Unit, HTTP and startup tests
    package.json
    package-lock.json
  frontend/
    src/
      components/               Shared UI, route announcements and page error boundary
      context/                  Authentication provider
      hooks/                    Resources, auth and notification polling
      layouts/                  Public and role workspaces
      pages/                    Lazy-loaded route screens
      routes/AppRoutes.jsx      Routes and loading/error boundaries
      services/                 API client and in-memory session store
      styles/                   Global, feature and responsive styles
      utils/                    Pure client helpers
      main.jsx                  Entry point and fixed stylesheet order
    tests/                      API, session, input and chart regression tests
    index.html
    vite.config.js
    package.json
    package-lock.json
  README.md                     Fresh-checkout start guide
  FEATURES.md                   Feature/API reference and historical phase details
  DEMO.md                       Isolated demo setup and walkthrough
  DEPLOYMENT.md                 Hosting requirements and limitations
  PUBLISHING.md                 Git/GitHub preparation
  TESTING.md                    Verification evidence and limits
  PHASES.md                     Milestone status
  COMMANDS.md                   Historical verification log
  phase*.png                    Recorded browser evidence
```

backend/.env and backend/.env.demo.local are local-only and ignored. The prepared showcase database is outside the source tree in local MongoDB. frontend/dist and both node_modules directories are generated and ignored. No remote repository or production deployment has been created.
