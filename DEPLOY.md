# Deploying: Vercel (website) + Render (backend)

Vercel only hosts static files and serverless functions. This project needs a
long-running Express server (for Socket.IO chat and the JSON database), so it
runs on Render while the website is served by Vercel.

The `404 NOT_FOUND` on Vercel happened because there was no `index.html` at the
repo root. `vercel.json` now serves the `web/` folder, which fixes it.

## 1. Deploy the backend on Render

1. Push this repo to GitHub.
2. Render Dashboard → **New** → **Blueprint** → choose this repository.
   Render reads `render.yaml` automatically.
   - If you prefer a manual Web Service: Root Directory `backend`,
     Build Command `npm install`, Start Command `npm start`.
3. Wait for the deploy, then copy the service URL, e.g.
   `https://college-event-backend.onrender.com`.
4. Open that URL. You should see the website served by the backend.
5. (Optional) In Render → your service → **Environment**, add `SMTP_HOST`,
   `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` to send real OTP emails.
   `JWT_SECRET` is generated automatically by the blueprint.

Notes for the free plan:
- The service sleeps after ~15 minutes idle; the first request takes ~30s to wake.
- `database.json` lives on an ephemeral disk, so data resets on redeploy/restart.
  Use a paid persistent disk or a real database for permanent data.

## 2. Point the website at the backend

Open `web/config.js` and set your Render URL (no trailing slash):

```js
window.CE_API_BASE = 'https://college-event-backend.onrender.com';
```

Commit and push. Vercel redeploys automatically.

For local development leave it as `window.CE_API_BASE = '';` so the website keeps
using the server it was loaded from (`http://localhost:3001`).

## 3. Fix the Vercel project settings

In Vercel → Project → **Settings** → **General**:

| Setting          | Value                          |
| ---------------- | ------------------------------ |
| Root Directory   | *(leave empty = repo root)*    |
| Framework Preset | Other                          |
| Build Command    | *(empty / default)*            |
| Output Directory | *(empty — `vercel.json` sets `web`)* |
| Install Command  | *(empty / default)*            |

Then **Deployments → Redeploy**. The root URL should now load the login page.

## 4. Verify

1. Open the Vercel URL → the login page appears.
2. Sign in with `admin` / `admin123` (or `student` / `student123`).
3. Create an event, then open chat in two browsers to confirm real-time works.

## Troubleshooting

- **Login says "Could not reach the server"** — check `web/config.js` contains the
  correct Render URL (https, no trailing slash) and that the Render service is awake.
- **CORS error** — the backend already allows any origin; make sure you redeployed
  the latest `backend/server.js`.
- **404 on Vercel** — confirm Root Directory is the repo root and `vercel.json`
  exists there, then redeploy.
