# Blueprint · Finance Process Catalogue

Map how you really work — and let AI find what's next.

Blueprint is the data-capture foundation of the finance directorate's native-AI
transformation (Project Vanguard). Every staff member documents their working
processes into a single catalogue; the app's understanding agent mines, refines
and classifies each step (agentic-AI / automation / human-in-the-loop), and
role-scoped dashboards turn the captured data into transformation decisions.

## The user journey

1. **Landing page** — what Blueprint is and how it works.
2. **Understanding you** — pick your role (CFO L1 → Executor L4, or Programme
   Admin), tell us your name, and set a password so only you can re-open your
   space later (stored locally, SHA-256 hashed).
3. **Capture journey** —
   - *Upload your working outputs* (reports, checklists, notes — optional),
   - *Describe your process* by typing **or talking** (Web Speech API),
   - the **understanding agent** counts, expands and classifies the steps,
   - *Review* the mined steps (edit, reorder, tag systems & collaborators),
   - *Confirm* — then choose: **Edit · Analyse · See results · Get advice**.
4. **Workspace** — role-scoped views:
   - **Dashboard** (L1/L2: directorate coverage, classification mix, champions,
     transformation plan · L3: team completion tracker, high-effort flags,
     guidance tracker),
   - **Catalogue** (search/filter, step timeline detail, print/PDF export),
   - **AI Refinement** (suitability score, drivers, explainable and overridable
     classifications),
   - **Inbox** (tags, chases, broadcasts),
   - **Programme admin** (hackathon challenge list, data quality, next-stage
     readiness, targeted notifications, dataset export).

## Run locally

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev        # http://localhost:3000
```

### AI engine

The mining (`POST /api/ai/mine`) and refinement (`POST /api/ai/analyze`)
endpoints use **Gemini** when a key is configured, and fall back to a built-in
rule-based engine otherwise — the demo always works without any key.

`/api/ai/mine` **segments one free-text dump into N distinct processes** (it
separates unrelated workstreams and discards non-work meta-content), then
structures the steps of each and maps every process to exactly one of the fixed
**lines of work** (`SUBFUNCTIONS_LIST` in `src/data/mockData.ts`). The capture
review stage lets you rename each process, edit its steps, and split/merge
before all of them save as separate catalogue entries.

To enable Gemini, set `GEMINI_API_KEY` in `.env.local` (the server loads
`.env.local` first, then `.env`). Override the model with `GEMINI_MODEL`
(default `gemini-3.5-flash`).

### Other scripts

```bash
npm run lint       # typecheck (tsc --noEmit)
npm run build      # production build (vite + esbuild server bundle)
npm run start      # serve the production build
```

## Deploy the UI to Vercel + connect the Google Sheet backend

This repo also ships `apps-script/` — a Google Apps Script backend (see
`apps-script/README.md` for its own setup) that can back this app with a real,
admin-managed Google Sheet instead of `localStorage`. To connect the two:

1. Deploy `apps-script/` following `apps-script/README.md`, and copy its web
   app `/exec` URL.
2. Import this repo into Vercel (`vercel.json` here just pins the build to
   `vite build` with output `dist` — no other config needed).
3. In Vercel → Project Settings → Environment Variables, add
   `VITE_APPS_SCRIPT_URL` set to that `/exec` URL, then redeploy.

With that variable set, the app's own **Onboarding/LockScreen local-profile
flow is replaced** by a real sign-in screen (`RemoteLogin`) against the
Sheet's `Users` — accounts are provisioned by an Admin from the Sheet's
**Blueprint Admin** menu or the Admin dashboard, not self-declared during
onboarding. Newly captured processes are also best-effort synced to the
Sheet's `Processes` tab (a one-time snapshot at creation — the Apps Script
API doesn't yet support updating that row on later edits) so an Admin gets
directorate-wide roll-up visibility without opening every user's browser.

Leave `VITE_APPS_SCRIPT_URL` unset and the app behaves exactly as it does
today — fully local, no Sheet involved.

**Known limitation:** the AI mining/refinement engine (`/api/ai/mine`,
`/api/ai/analyze` below) runs on the Express server in `server.ts`, which a
static Vercel deploy does not run — those endpoints will 404 on Vercel as
configured here. Porting them to Vercel serverless functions is a separate,
larger piece of work than the Sheets integration and hasn't been done yet.

## Notes

- All data is local-first: processes, systems and your profile persist in
  `localStorage`; the capture journey autosaves a draft so interruptions never
  lose work. This changes only when `VITE_APPS_SCRIPT_URL` is set (see above).
- The rail's **View as** switcher is a demo affordance to preview every
  role's scoped experience without re-onboarding.
