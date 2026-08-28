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

### ROI / TCO engine (group finance)

Every process page's **AI Deployment Roadmap** section includes an ROI/TCO
panel that compares AI document/process automation (Gemini) against RPA for
a **group finance / shared-services** process — AP invoicing, intercompany
reconciliation, month-end close support, management reporting, or tax &
compliance docs (or any new process you configure the same way).

It replaced an earlier naive model that compared an RPA license price
directly against a raw Gemini token cost. Token/API cost is one line item —
this engine computes a full **Total Cost of Ownership** (inference + human
review labor + maintenance + infra + compliance + amortized integration
build cost), separates **hard cash benefit** from **soft capacity value**
(hours freed only count once scaled by a redeployment factor), subtracts
error-rework cost, and computes payback on cumulative cash flow through a
realistic adoption ramp (pilot → parallel-run → steady state) instead of an
instant break-even. See:

- `src/lib/roiTcoEngine.ts` — the calculation engine (pure TypeScript, no
  UI/React dependency; every function is commented with the reasoning behind
  it).
- `src/lib/roiTcoDefaults.ts` — wires the pricing table + a process template
  into the engine's input shape.
- `src/data/pricingStandards.ts` — the shared "Daftar Harga Standar
  Indonesia" cost-assumption table (also used by the Consolidated PRD Hub's
  price sheet), with an inline comment on why each rate/default was chosen.
- `src/data/financeProcessTemplates.ts` — the selectable/editable finance
  process presets (config only — adding a 6th process needs no engine code
  changes).
- `src/components/FinanceRoiTcoPanel.tsx` — the in-app UI (scenario
  comparison, cumulative cash-flow chart, RPA/AI/Hybrid comparison,
  sensitivity callout, CSV export). It has its own "How this works" panel
  explaining the model and every input.
- `POST /api/finance/roi-tco` (`server.ts`) — a thin API wrapper around the
  same engine module, for parity with the app's other calculation endpoints.

Run `npm test` to execute the engine's test suite (`src/lib/roiTcoEngine.test.ts`,
via vitest), which asserts: token cost is never treated as TCO, soft capacity
savings don't leak into hard-cash payback, payback lengthens as the
parallel-run window grows, and the engine runs for multiple configured
processes with zero code changes (config only).

### VPRS PDF generator (Prepare for Production)

Every process page's **AI Deployment Roadmap** card ends with **Generate VPRS
Pack** once a roadmap exists. It turns the process and its roadmap into a
print-ready **Vendor Production Requirement Specification** — the document
that goes to procurement and the vendor — as a PDF, plus the Markdown and
HTML it was built from.

- `vprs-pdf/` — a vendored, self-contained package (its own `package.json`,
  test suite, and README — see `vprs-pdf/README.md` for the full design
  notes: the section registry, the Group-boilerplate defaults, the
  full/brief profiles, mermaid rendering, and more). Unmodified except for
  one small addition (`launchArgs` passthrough) needed for the Vercel path
  below.
- `api/_lib/vprsPdf.ts` — the actual integration: `buildVprsSpec()` maps a
  catalogue `Process` + its generated `DeploymentPlan` into a spec (mapping
  decisions and what's deliberately left for vendor confirmation, rather
  than guessed, are commented inline), then `generateVprsPdfPack()` runs it
  through the vendored pipeline. Reused by both entry points below.
- `POST /api/vprs-pdf` — the Vercel serverless function (production) and the
  matching Express route in `server.ts` (local dev), same pattern as
  `api/blueprint.ts` / `/api/blueprint`.
- `src/components/VprsPdfPanel.tsx` — the in-app UI (profile picker,
  generate button with loading/error states, PDF/Markdown/HTML download,
  inline HTML preview).

**Chromium.** The PDF stage needs a real browser. Locally, `vprs-pdf/src/pdf.js`
finds one on disk itself (e.g. under `PLAYWRIGHT_BROWSERS_PATH`) — nothing to
configure. On Vercel there's no browser in the function image, so
`api/_lib/vprsPdf.ts` resolves one via `@sparticuz/chromium` instead, only
when `process.env.VERCEL` is set. **This pairing is version-pinned, not
range-matched:** `playwright-core` and `@sparticuz/chromium` are both exact
versions (not `^`) in `package.json`, hand-verified together (a full 26-page
reference pack, including a mermaid diagram, rendered correctly). A `^`
range on `playwright-core` would drift to expect a newer Chromium revision
than whatever `@sparticuz/chromium` last shipped — bump both together and
re-render the reference example before trusting a version bump here.
`vercel.json` also raises this one function's `maxDuration` (60s) and
`memory` (2048MB) — PDF rendering is slower and heavier than the app's other
serverless calls.

**Language.** The Group-boilerplate defaults in `vprs-pdf/src/defaults.js`
(security roles, documentation checklist, support SLAs, vendor deliverables,
AI guardrails) are only curated in Indonesian, so every generated pack is
`meta.language: 'id'` regardless of the app's own language toggle — an
English spec would render missing all of that. Adding an English defaults
bundle is future work (see the `DEFAULTS` map in that file).

Run `npm test` to execute `api/_lib/vprsPdf.test.ts` (vitest) — proves the
mapper always produces schema-valid output (via the vendored AJV
`validateSpec`), across solution types and with/without gaps, decision
points and systems, and that it never fabricates integration technical
detail it doesn't have. The vendored tool's own 32-assertion suite
(schema/profile/locale/rendering behaviour, including a full PDF render) is
separate — run it with `cd vprs-pdf && npm test`.

### Other scripts

```bash
npm run lint       # typecheck (tsc --noEmit)
npm run test       # unit tests (vitest) — includes the ROI/TCO engine suite
npm run build      # production build (vite + esbuild server bundle)
npm run start      # serve the production build
```

## Deploy to Vercel + connect a Postgres backend

The remote backend is a small Postgres-backed API (`api/blueprint.ts`, a
Vercel serverless function; `api/_lib/{db,auth,actions}.ts` hold the actual
logic) instead of `localStorage`. **Neon** (via Vercel's Storage tab) is the
easiest way to get a free Postgres instance wired up with zero manual
connection-string handling.

1. In your Vercel project → **Storage** → **Create Database** → **Neon** →
   connect it to this project. Vercel automatically injects `DATABASE_URL`
   into your deployments — nothing to copy by hand.
2. Generate a random signing secret (e.g. `openssl rand -hex 32`) and add it
   in **Project Settings → Environment Variables** as `AUTH_TOKEN_SECRET`.
   This signs login sessions; it's unrelated to the database.
3. Add one more environment variable: `VITE_ENABLE_REMOTE_AUTH` = `true`.
4. Redeploy. The database tables (`users`, `processes`, `audit_log`,
   `prd_engines`) are created automatically on first request — no migration
   step to run.
5. Open the deployed site. You'll land on a sign-in screen; click **"First
   time setting this up? Create the Admin account"**, enter your name and
   email, and you'll get a username + one-time temporary password (shown
   once — copy it). Sign in with those, and change your password from there.
   That bootstrap path only works once, before any account exists — everyone
   after you gets created from the Admin dashboard.

Leave `VITE_ENABLE_REMOTE_AUTH` unset and the app behaves exactly as it does
without a database: local Onboarding/LockScreen, `localStorage` only.

Newly captured processes are best-effort synced to Postgres (a one-time
snapshot at creation — the API doesn't yet support updating that row on
later local edits) for directorate roll-up visibility via the dashboard API
endpoints in `api/_lib/actions.ts` (not yet wired into the React app's own
dashboard screens — those still read local state; wiring them up is a
separate, larger change).

**PRD Engine Hub:** "Sync New Processes" and "Erase" on the Consolidated PRD
& Engine Hub read/write Postgres's `prd_engines` table via `listPrdEngines` /
`syncPrdEngines` / `deletePrdEngine` (see `api/_lib/prdEngine.ts` for the
generation step and `src/lib/prdEngineLocal.ts` for the `localStorage`
fallback used when `VITE_ENABLE_REMOTE_AUTH` is unset). The "generation" step
is a deterministic consolidation heuristic, not an LLM call — swapping in a
Gemini-backed version later only requires changing `generatePrdEngine()`.

**Known limitation:** the AI mining/refinement engine (`/api/ai/mine`,
`/api/ai/analyze` below) still runs on the Express server in `server.ts`,
which a static Vercel deploy does not run — those endpoints will 404 on
Vercel as configured here. Porting them to Vercel serverless functions
(like `api/blueprint.ts` now is) is a separate piece of work. The ROI/TCO
engine's `POST /api/finance/roi-tco` route (also in `server.ts`) has the same
limitation on Vercel — but it doesn't block the feature, since the in-app
panel runs the same `src/lib/roiTcoEngine.ts` module directly client-side.

### Previously: Google Sheets + Apps Script

`apps-script/` (see `apps-script/README.md`) is an earlier, independent
backend that used a Google Sheet instead of Postgres, with its own
Sheets-native dashboard UI. It's superseded by the Postgres path above and
no longer wired into this React app, but the code is left in place if you'd
rather run that instead.

## Notes

- All data is local-first: processes, systems and your profile persist in
  `localStorage`; the capture journey autosaves a draft so interruptions never
  lose work. This changes only when `VITE_ENABLE_REMOTE_AUTH` is set (see above).
- The rail's **View as** switcher is a demo affordance to preview every
  role's scoped experience without re-onboarding.
