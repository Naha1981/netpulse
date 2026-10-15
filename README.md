# NetPulse AI

AI onboarding and operations intelligence layer for small South African ISPs
and WISPs. This repo is the **Phase 1 MVP**, scoped per the execution plan:
the AI Migration Wizard, AI Health Report, and a constrained AI Copilot —
not the full 12-module platform. See `/docs` for the PRD, go-to-market plan,
execution plan, and lead-gen prompt this build follows.

## What's actually built here

- **Auth** — Supabase email/password signup and login, with a confirmation
  email flow.
- **Onboarding** — create an organization (ISP), pick network type.
- **AI Migration Wizard** — upload an `.xlsx`/`.xls`/`.csv` file, the AI
  (via Groq) detects whether it's customers, IP addresses, or equipment,
  proposes a field mapping, the user reviews/adjusts it, then imports.
- **Validation** — duplicate IP detection, invalid IP format detection,
  missing required fields, duplicate serial numbers, expired warranties.
  This is deterministic TypeScript, not AI — see the code comment in
  `src/lib/ai/validate.ts` for why that split matters.
- **AI Health Report** — a generated narrative summary shown immediately
  after import, backed by the exact validation findings (the AI writes the
  words, never the numbers).
- **AI Copilot** — natural-language questions answered against a fixed,
  safe set of query intents (never freeform SQL from the LLM — see
  `src/lib/ai/copilot.ts`).
- **Multi-tenant data model** — every table is scoped by `organization_id`
  and protected by Postgres Row Level Security, so one ISP's data is never
  visible to another's, enforced at the database layer, not just in
  application code.

## What's intentionally NOT built yet

Per the execution plan's phasing: technician scheduling, equipment/GIS
mapping, network monitoring (SNMP), native billing, and the fuller set of
AI agents are Phase 2/3 — after Phase 1 has paying customers. Building them
now would be scope creep against the plan.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres, Auth, Storage, Row Level Security)
- Groq (configurable JSON model; default GPT OSS 20B) for AI mapping, health report narration, and Copilot
- SheetJS (`xlsx`) + PapaParse for spreadsheet parsing

## Setup

### 1. Create a Supabase project

At [supabase.com](https://supabase.com), create a new project, then:

1. Go to **SQL Editor** and run the entire contents of `supabase/schema.sql`.
   This creates every table, RLS policy, and the private `uploads` storage
   bucket in one pass.
2. Go to **Project Settings → API** and copy your Project URL, anon key,
   and service role key.
3. (Optional but recommended) In **Authentication → URL Configuration**,
   set your Site URL and add `/auth/callback` as a redirect URL once you
   have a deployed domain.

### 2. Get a Groq API key

Sign up at [console.groq.com](https://console.groq.com) and create an API
key. Groq's free tier is enough to build and test Phase 1 end-to-end.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in the three values from steps 1–2.

### 4. Install and run

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

### 5. Try the core flow

1. Sign up → confirm email → you'll land on onboarding.
2. Pick a network type, name your organization.
3. Upload a test spreadsheet. A minimal customers CSV to try:

   ```csv
   Customer Name,Email,Phone,Plan
   Jane Dlamini,jane@example.com,0821234567,Growth 20Mbps
   Sipho Nkosi,sipho@example.com,0839876543,Starter 10Mbps
   ```

4. Review the AI's proposed mapping, click Import, and you'll land on the
   AI Health Report.
5. Go to **Copilot** and ask one of the suggested questions.

## Deployment

This is a standard Next.js app — deploys cleanly to Vercel:

1. Push this repo to GitHub (already done if you're reading this there).
2. Import the repo in Vercel.
3. Add the same three environment variables from `.env.example` in the
   Vercel project settings.
4. Deploy. Update your Supabase Auth redirect URL to match the deployed
   domain's `/auth/callback`.

No other infrastructure is required for Phase 1 — no VPS, no queue, no
separate worker process.

## Known Phase 1 limitations (by design, not oversight)

- File size cap: 15MB / ~20,000 rows per upload. Fine for the target
  segment (1–20 staff ISPs); revisit if Phase 2 targets larger ISPs.
- One organization per user. Multi-org switching is a small addition to
  `src/lib/org.ts` when it's actually needed — the data model (a join
  table for membership) already supports it.
- The Copilot only answers the 5 intents defined in
  `src/lib/ai/copilot.ts`. This is intentional scope control, not a bug —
  expanding it should track new modules being built, not run ahead of them.
- Regression tests now cover tenant isolation, atomic onboarding, storage boundaries, import rollback/retry, mapping validation and date/status normalization. Run `npm test`.

- Historical note: no automated test suite existed in the original prototype. Given the solo/bootstrapped context, the
  highest-value next testing investment is running real (anonymized)
  prospect spreadsheets through the wizard — see Phase 0 of the execution
  plan — rather than unit tests for a data model still likely to change
  with real user feedback.
- SheetJS now comes from the official patched 0.20.3 tarball rather than the vulnerable npm 0.18.5 build. Run `npm audit` before deployment.

## Safety repairs and existing databases

Fresh projects use `supabase/schema.sql`. Existing Phase 1 projects must apply the two reviewed SQL migrations in `supabase/migrations/` in order before deploying this code. Back up and test against a staging copy first. The first migration fails safely if existing cross-tenant foreign keys violate the new constraints; reconcile those records before retrying. The second adds duplicate-content protection and atomic, locked, retry-safe imports.

`npm test` uses synthetic data in an isolated PostgreSQL-compatible engine. It does not connect to a live Supabase account. Test actual email confirmation, storage upload, three imports and all Copilot intents against a dedicated demo project before admitting customer data. Default demo deployments are for synthetic/anonymized data only.


## Project structure

```
src/
  app/
    page.tsx                 landing page
    login/, signup/          auth pages
    onboarding/               org creation + upload wizard
    dashboard/                overview, copilot
    api/
      organizations/          create org
      wizard/analyze/         parse file, propose AI mapping
      wizard/import/          apply mapping, validate, write rows, health report
      copilot/                answer questions via constrained intents
  lib/
    supabase/                 browser/server/admin clients
    parsing/                  xlsx/csv parsing
    ai/                       mapping, validation, health report, copilot
    org.ts                    current-user organization lookup
supabase/
  schema.sql                  full DB schema + RLS + storage policies
docs/
  PRD, go-to-market plan, execution plan, lead-gen prompt
```
