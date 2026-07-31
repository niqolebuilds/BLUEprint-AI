# Blueprint — Google Sheets + Apps Script deployment

This connects a role-scoped Blueprint dashboard (L1, L2, L3, L4, Admin) to a
Google Sheet via an Apps Script web app **bound directly to that Sheet**
(the script reads `SpreadsheetApp.getActiveSpreadsheet()` — there's no
spreadsheet ID to configure; it just uses whichever Sheet you attach it to
via that Sheet's own **Extensions → Apps Script** menu). It is independent
of the React app in this repo — the Sheet is the database, Apps Script is
the backend and the UI.

## What gets created

The script manages three tabs in that spreadsheet (created automatically the
first time you run setup — don't create them by hand):

- **Users** — one row per person: `Username, Name, Email, Level, SubFunction,
  PasswordHash, Salt, Active, CreatedAt, LastLogin`. Passwords are never
  stored in plain text — only a salted, iterated SHA-256 hash.
- **Processes** — one row per captured process, with the ratings, step
  classification counts, and status fields the dashboards read.
- **AuditLog** — who logged in, submitted, or was created/reset, and when.

## 1. Attach the script to the Sheet

1. Open the spreadsheet, then **Extensions → Apps Script**.
2. Delete the default empty `Code.gs` content.
3. In this folder there are 5 files: `appsscript.json`, `Code.gs`,
   `Index.html`, `Stylesheet.html`, `JavaScript.html`. For each one, create a
   matching file in the Apps Script editor (**+ → Script** for `Code.gs`,
   **+ → HTML** for the three `.html` files) and paste the contents in.
   For `appsscript.json`: click the gear icon **Project Settings** → check
   "Show `appsscript.json` manifest file in editor" → open it → paste in.
4. Save the project (Ctrl/Cmd+S).

## 2. Initialize the sheets

1. Back in the spreadsheet tab, **reload the page** (Apps Script menus only
   register after a fresh load). You should see a new **Blueprint Admin**
   menu next to Help.
2. Click **Blueprint Admin → 1. Initialize sheets**. The first time, Google
   will ask you to authorize the script — review and allow it (this is your
   own script, running under your own account).
3. This creates the `Users`, `Processes`, and `AuditLog` tabs.

## 3. Create your Admin account (you)

Click **Blueprint Admin → Create user**, and answer the prompts:
- Name: your name
- Email: your Siloam email
- Level: `Admin`
- Sub-function: `All`

You'll get a **username and a one-time temporary password** in an alert
box — copy it now, it won't be shown again. You can change it after your
first login.

## 4. Deploy as a web app

1. In the Apps Script editor: **Deploy → New deployment**.
2. Type: **Web app**.
3. Execute as: **Me** (your account) — this is what lets the script read/write
   the Sheet on everyone's behalf without giving them Sheet access.
4. Who has access: **Anyone within [your domain]** if this is a Google
   Workspace account (recommended), or **Anyone with the link** otherwise.
   This is set in `appsscript.json` as `"access": "DOMAIN"` — change to
   `"ANYONE"` there if you're not on Workspace.
5. Click **Deploy**, authorize again if prompted, and copy the **web app
   URL**. You can also fetch it later from **Blueprint Admin → Show web app
   URL**.

Whenever you edit the code afterwards, you must create a **new deployment
version** (Deploy → Manage deployments → edit → New version) for changes to
go live — saving the script alone does not update a live deployment.

## 5. Create everyone else's accounts

Still from **Blueprint Admin → Create user** (repeat per person), or do it
from inside the web app itself once you're logged in as Admin (Admin view has
a "Create a new user" form). Each person gets:

- their own **username** (auto-generated from their email) and a
  **one-time temporary password** — send these to them privately (Slack DM,
  in person), not in a group channel or email thread others can see.
- a **Level** (`L1`/`L2`/`L3`/`L4`/`Admin`) and a **Sub-function**, which
  together drive what they can see (see "How access control works" below).

Send people the **web app URL only**. Nobody except you (the Admin) needs
edit access to the underlying spreadsheet — keep Sheet sharing locked down to
just yourself, since the `Users` tab holds password hashes and every
person's data.

## How access control (RLS) works

Every login issues a signed, expiring token (like a lightweight JWT) that
encodes the user's username, name, level and sub-function. Every server
function re-validates that token and filters spreadsheet rows before any
data leaves the server — the browser never receives rows it isn't allowed to
see:

| Level | What they see |
|---|---|
| **L4** | Only their own submitted processes ("My processes"), plus the capture form to add new ones. |
| **L3** | A team view scoped to their own sub-function: a completion tracker for everyone in that sub-function, high-effort flags, and a guidance tracker for low-completeness processes. |
| **L1 / L2** | The full directorate view: totals, classification mix, coverage by sub-function, champions, and top automation candidates across everyone. |
| **Admin** | Everything L1/L2 see, plus the full user roster, data-quality gaps, next-stage readiness by sub-function, user management (create/reset/deactivate), and a CSV export of the Processes sheet. |

Passwords are hashed (salted, 2000-round SHA-256) before they ever touch the
Sheet — nobody, including you as Admin, can look up anyone's plaintext
password. Use **Blueprint Admin → Reset user password** if someone forgets
theirs.

### Honest limitations

This is a lightweight auth layer appropriate for an internal tool, not a
compliance-grade identity system:
- There's no rate-limiting or lockout on failed logins.
- Anyone with **Edit access to the Sheet** can see the `Users` tab (hashes,
  not passwords) and every row in `Processes` directly, bypassing the
  web app's RLS — so keep Sheet sharing restricted to you as Admin.
- Session tokens last 8 hours (`TOKEN_TTL_MINUTES` in `Code.gs`) and aren't
  revocable individually before then; deactivating a user (`Blueprint Admin
  → Activate / deactivate user`) blocks new logins immediately but doesn't
  invalidate an already-issued token until it expires.

If you later need stronger guarantees (SSO, audit-grade access logs,
individual session revocation), that points toward Google Workspace's native
identity (`Session.getActiveUser()` + domain restriction) instead of a custom
username/password table — happy to wire that up instead if it matters more
than plain usernames/passwords.
