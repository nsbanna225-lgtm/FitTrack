# Deployment notes

## Render deployment

The included `render.yaml` builds the frontend and backend as one web service. Express serves `frontend/dist` and the API on the same origin, so no cross-origin API configuration is needed. The build expects the repository root to contain `frontend/`, `backend/` and `render.yaml`.

1. Push the FitTrack project to a private GitHub repository. Do not commit `.env` files, database credentials, or VAPID private keys.
2. Create a MongoDB Atlas database and database user. Allow the Render service to connect in Atlas Network Access; use the Atlas connection string as `MONGODB_URI`, including the correct database name and encoded credentials.
3. In Render, create a Blueprint from the GitHub repository and deploy `render.yaml`. Render generates `JWT_SECRET`; enter the Atlas URI when prompted for `MONGODB_URI`.
4. Wait for `/api/health` to pass, then open the Render HTTPS URL and sign in. Install from the browser menu: Chrome on Android, or Safari Share → Add to Home Screen on iPhone.

The Blueprint uses Render's free web-service plan, which may sleep when idle. This is suitable for a college demo but can make the first request slow, and background reminders are not reliable while the service is asleep. Choose an always-on plan for dependable scheduled push reminders. Add the three `VAPID_*` values from the phone-push section below in the Render environment settings to enable push.

For other hosts, build with `npm ci` and `npm run build` in `frontend/`. Serve `frontend/dist` from the Express app or a static host configured to proxy `/api` to Express before applying the `index.html` fallback. Keep frontend and API on the same origin; CORS is not configured. Vite dev/preview is for local development, not the production service.

Run npm ci --omit=dev and npm start in backend with NODE_ENV=production, MONGODB_URI and a random JWT_SECRET of at least 64 characters. Set HOST and PORT for the private listener required by the hosting platform. Startup connects to MongoDB and ensures indexes before accepting requests. Do not serve backend files or environment files from the static root.

Use HTTPS at the reverse proxy. Configure document security headers there: the API's restrictive JSON content security policy is not a frontend policy. The frontend currently uses Google Fonts, inline React style attributes and SVG charts, which a document CSP must account for. Hashed frontend assets can use long immutable caching; index.html should revalidate so deployed chunk names stay current. Preserve old hashed assets during rollout where possible. The page error fallback supports reloading after a missing chunk; refreshing signs out and can discard unsaved form edits.

The frontend is installable as a PWA. On Android, open the deployed HTTPS URL in Chrome and choose Install app. On iPhone (iOS 16.4 or later), open it in Safari, choose Share, then Add to Home Screen; web push works only after installation on iOS. The app requires an internet connection; it does not cache private pages for offline use.

Phone push is optional. From `backend/`, run `npx web-push generate-vapid-keys` once, then set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` in the backend environment (`VAPID_SUBJECT` should be a `mailto:` contact or HTTPS URL). Keep the private key secret and use the same key pair across backend instances. Restart the API, sign in on the installed phone app, open Notifications and choose Enable phone notifications. Background reminder generation runs every minute while the API is running; each device can turn notifications off from that page.

Keep MongoDB private and configure authenticated access, backups and restore procedures for a real deployment. Use GET /api/health for liveness and GET /api/ready for database readiness. Configure trusted proxy handling for your actual proxy topology before relying on client-IP rate limits. Do not broadly trust arbitrary forwarding headers. Multiple API instances need shared rate-limit storage.

Do not deploy the local demo environment or enable real-money claims. Password-reset delivery, transactional payment integration, monitoring, load tests and production/Atlas connectivity remain separate work. No production deployment was performed in this phase.
