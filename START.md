# Procurix — Start Guide

Feature :- https://claude.ai/code/artifact/53332ef2-0bff-4920-8b8b-3950f4c90f74

How to get the agent + UI running on a fresh machine.

Everything runs as **one Next.js app**. The UI and the AI agent are in the same project — there is no separate backend to start. `npm run dev` starts both.

---


## 1. What you need first

| Thing | Why | Where |
|---|---|---|
| **Node.js 22 LTS** | Next 16 / React 19 need it | https://nodejs.org |
| **Supabase account** | Database (free tier is fine) | https://supabase.com |
| **Google AI Studio key** | The Gemini model that powers the agent | https://aistudio.google.com/apikey |
| **Google Cloud project** | Login + Gmail sending | https://console.cloud.google.com |
| Lemon Squeezy account | Payments — **optional**, skip for local dev | https://lemonsqueezy.com |

Check your Node version:

```bash
node -v      # use v22 LTS
```

Node 20.13 or older will install and mostly work, but some packages (`undici`, `yargs`) declare they need 20.18+. Use 22 LTS and avoid the guesswork.

---

## 2. Install

```bash
cd "n:/Dev/Portfolio Apps/AI Agent"
npm install
```

Takes a few minutes. If it fails, see [Troubleshooting](#8-troubleshooting) — `chartjs-node-canvas` is the usual culprit on Windows.

**Expect warnings.** `npm install` prints `EBADENGINE` warnings, a deprecation notice for `node-domexception`, and around 60 vulnerabilities. This is normal for a project this size. They are DoS bugs in deep build-time dependencies, not anything reachable in the running app.

**Never run `npm audit fix --force`.** It bumps `next` and `langchain` across major versions and will break the project. Leave the warnings alone.

---

## 3. Set up the database

Open your Supabase project → **SQL Editor** → paste and run each file from [database/](database/) **in this exact order**. Order matters because later tables reference earlier ones.

```
1. userprofile-setup.sql            -- users from Google login
2. customers-setup.sql              -- plans + credits
3. auctions-setup.sql               -- auctions, bids, vendors, invitations
4. auction-documents-setup.sql      -- files attached to auctions
5. auction-documents-update.sql     -- switches file storage to base64
6. integrations-setup.sql           -- stores Gmail OAuth tokens
7. rfp-counter-setup.sql            -- gives RFPs numbers like RFP-0001
8. vendors-customer-association.sql -- links vendors to the customer who owns them
```

Then create a **storage bucket** named `reports` (Storage → New bucket) — executive report PDFs get uploaded there.

> **Note:** `customers-setup.sql` uses plain `CREATE TABLE`, not `CREATE TABLE IF NOT EXISTS`. If you run it twice it will error. That's fine — it means the table already exists.

---

## 4. Get your Google credentials

You need **one** Google Cloud project that does **two** jobs.

**a) Enable the Gmail API**
APIs & Services → Library → search "Gmail API" → Enable.

**b) Create an OAuth client**
APIs & Services → Credentials → Create Credentials → OAuth client ID → **Web application**.

Add **both** of these as Authorized redirect URIs:

```
http://localhost:3000/api/auth/google/callback
http://localhost:3000/api/auth/google/gmail/callback
```

The first is for logging in. The second is for connecting Gmail so the agent can send emails. They are separate flows — you need both.

Copy the **Client ID** and **Client Secret**.

**c) Add yourself as a test user**
OAuth consent screen → Test users → add your own Gmail address. Without this, Google blocks the login.

---

## 5. Create `.env.local`

Make a file called `.env.local` in the project root and paste this in, filling your own values:

```bash
# ---------- Supabase ----------
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_REPORTS_BUCKET=reports

# ---------- AI model ----------
# Read automatically by LangChain — the name must be exactly this
GOOGLE_API_KEY=your-google-ai-studio-key

# ---------- Google login ----------
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
JWT_SECRET=any-long-random-string

# ---------- Gmail sending ----------
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/gmail/callback

# ---------- App URLs ----------
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000

# ---------- Optional: email fallback if Gmail OAuth isn't connected ----------
SENDER_EMAIL=you@gmail.com
SENDER_PASSWORD=your-gmail-app-password

# ---------- Optional: payments (skip for local dev) ----------
NEXT_PUBLIC_LEMON_SQUEEZY_STORE_ID=
LEMON_SQUEEZY_API_KEY=
NEXT_PUBLIC_LEMON_SQUEEZY_STORE_DOMAIN=
NEXT_PUBLIC_LEMON_SQUEEZY_VARIANT_ID_TOPUP_URL=
NEXT_PUBLIC_LEMON_SQUEEZY_VARIANT_ID_PLUS_URL=
LEMON_SQUEEZY_VARIANT_ID_TOPUP=
LEMON_SQUEEZY_VARIANT_ID_PLUS=

# ---------- Optional: analytics ----------
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
```

Two things people get wrong here:

- `GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` hold the **same value**. There are two names because one is used on the server and one in the browser. Set both.
- `GOOGLE_API_KEY` is the **Gemini** key, and it is never referenced in the code — LangChain picks it up from the environment by name. Spell it exactly right or the agent silently fails.

`SENDER_PASSWORD` is a Gmail **App Password**, not your normal password. Get one at https://myaccount.google.com/apppasswords.

---

## 6. Run it

```bash
npm run dev
```

Open **http://localhost:3000**

Other commands:

```bash
npm run build      # production build (checks .env.local exists first)
npm start          # run the production build
npm run lint       # eslint
npm run deploy     # deploy to Cloudflare Workers
```

---

## 7. First run — do these in order

1. Go to http://localhost:3000 and click **Login with Google**.
2. Finish onboarding (it asks your role and industry).
3. Land on the [dashboard](src/pages/dashboard.tsx).
4. Open **Settings → Integrations** and click **Connect Gmail**. This is a *separate* consent screen from login. **Skip this and every email the agent sends will fail.**
5. Test the agent by typing into the chat:

```
Add vendor test@example.com
List all my vendors
Create an RFP for 100 office chairs
Schedule an auction for office chairs starting tomorrow at 3pm
```

If vendors save and appear, the DB is wired correctly. If the RFP PDF generates, the agent is working. If the email sends, Gmail is connected.

---

## 8. Troubleshooting

**`npm install` fails on `chartjs-node-canvas`**
It compiles native code and needs build tools on Windows:
```bash
npm install --global windows-build-tools
```
Or just skip it — it's only used for charts inside executive report PDFs:
```bash
npm install --ignore-scripts
```

**Agent replies but never uses any tool**
`GOOGLE_API_KEY` is missing or misspelled in `.env.local`. Restart the dev server after editing it — Next.js does **not** hot-reload env files.

**`redirect_uri_mismatch` on login**
The URI in Google Cloud must match `.env.local` character for character. `http` vs `https`, trailing slash, and port all matter. Remember you need **both** callback URLs from step 4.

**Emails fail silently**
Gmail isn't connected. Settings → Integrations → Connect Gmail. Logging in with Google is *not* the same thing.

**"Insufficient credits"**
Free plan gives 50 chats and 10 documents. Open Supabase → `customers` table → find your email → set `plan_chat_credit` and `plan_doc_credit` to `-1` for unlimited.

**Agent forgets the conversation**
Known issue. `MemorySaver` in [agent.tsx:26](agent/agent.tsx#L26) stores memory in RAM, so it resets whenever the server restarts. Fine locally, breaks on Vercel.

**Report PDFs fail to generate**
The `reports` storage bucket doesn't exist in Supabase. Create it.

---

## 9. Where things live

```
agent/agent.tsx          # the brain — model, tools, system prompt
agent/tools/             # what the agent can actually do
  rfptool.tsx            #   generate RFP PDFs
  emailtool.tsx          #   send email via Gmail
  auctiontool.tsx        #   schedule / view / monitor auctions
  vendortool.tsx         #   add, list, delete vendors
  reporttool.tsx         #   executive reports with charts

src/pages/dashboard.tsx  # main chat UI
src/pages/api/agent/chat.ts   # streams the agent's replies to the browser
src/pages/auction/       # live bidding pages for clients and vendors
src/lib/                 # supabase, gmail, payments, helpers
database/                # SQL schemas — run these in Supabase
```

**To add a new agent tool:** create it in `agent/tools/`, then import and register it in the `tools: [...]` array in [agent.tsx:30-41](agent/agent.tsx#L30-L41). Then describe it in the system prompt below that, or the model won't know when to use it.
