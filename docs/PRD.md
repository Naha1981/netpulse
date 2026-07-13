# NetPulse AI — Product Requirements Document (PRD)
**Version 3.0 (Validated)**
AI Onboarding & Operations Copilot for Internet Service Providers

---

## 0. Validation Note — Read This First

Before building, be clear-eyed about the market: **NetPulse AI is not entering an empty category.**

Splynx, DataTill (built in George, Western Cape — a direct local competitor), Netzur, XceedNet, WISPGate, and VISP all already sell billing + CRM + network monitoring platforms into WISPs and ISPs, including South African ones. Splynx in particular has published South African case studies claiming 30% revenue growth and churn cut to 3% for one client, and 200% customer base growth for another. These are funded, established products with years of feature depth in billing, RADIUS, hotspot management, and MikroTik integration.

**Implication:** "Replace your spreadsheets with one platform" is not a differentiator — it's the whole industry's pitch. If NetPulse AI is positioned as "Splynx but newer," it loses on feature depth, support infrastructure, and trust, every time.

**What is genuinely defensible, and what this PRD is now scoped around:**

1. **The AI Migration Wizard** — zero-mapping-required spreadsheet ingestion with an AI health report generated within minutes of signup. Competitors mention "migration support" as a service; none of them make it a self-serve, AI-driven, zero-call product moment.
2. **The AI Copilot / Agent layer** — natural-language querying and autonomous agents (support, inventory, growth) sitting on top of ISP operations data. This is a genuinely new category layer, not a billing feature.
3. **Speed-to-value for the smallest ISPs** (1–20 staff) who are priced out of, or too small to justify, a full Splynx/DataTill implementation.

Everything else in this PRD (IP management, technician scheduling, GIS, fault management) should be built **only as much as is needed to make the AI layer credible** — not as a from-scratch competitor to mature billing platforms. Where possible, integrate with existing billing tools (including Splynx/DataTill via CSV/API) rather than rebuild billing from zero. This changes build cost from "12-module enterprise SaaS" to "a sharp wedge product with room to expand."

---

## 1. Vision

NetPulse AI is the **AI onboarding and intelligence layer for Internet Service Providers** — the fastest way for a small or mid-sized ISP to go from spreadsheets and disconnected tools to a single, AI-understood view of their operations, without a sales call, a consultant, or a migration project.

**Promise:** *From Excel to AI-powered operations in under 15 minutes.*

## 2. Mission

Give every ISP — even a 3-person WISP with no IT department — the operational intelligence that today only larger ISPs can afford through consultants and custom integration work.

## 3. Target Customers

**Primary (beachhead):**
- Small WISPs, 1–20 staff, currently running on Excel/Google Sheets, no dedicated ops software
- Fibre ISPs in the early-growth stage (post-launch, pre-Series-A-equivalent scale)

**Secondary (expansion, not v1):**
- Medium ISPs (20–100 staff) already using a competitor, evaluating a switch or an add-on AI layer
- Fibre Network Operators, campus/private networks, municipal broadband

Do not target Enterprise/FNO in v1 — that segment expects integrations, SLAs, and support infrastructure a solo/small team cannot yet deliver credibly.

## 4. Problem

Small ISPs run critical infrastructure (customer records, IP allocations, technician jobs, equipment) on spreadsheets. This causes:

- Duplicate IP assignments and address conflicts
- No visibility into which equipment is deployed where, or under warranty
- Technician coordination by WhatsApp and phone, no job history
- No early warning on network or capacity problems
- Founders spending hours per week on manual admin instead of growth

Existing platforms (Splynx, DataTill, Netzur) solve *some* of this — but require a deliberate implementation decision, a spreadsheet export/import project, and (for the smallest operators) more platform than they need or can configure alone.

## 5. Solution

NetPulse AI removes the *decision cost* and *migration cost* of adopting ISP software:

- Upload the spreadsheet you already have. NetPulse AI's AI reads it, understands what it's looking at, proposes field mappings, flags data problems, and imports it — no mapping screens, no consultant call.
- Within minutes, get an **AI Health Report**: duplicate IPs, orphaned equipment, expiring warranties, at-risk customers — value delivered before the ISP has configured anything.
- From there, a natural-language **AI Copilot** ("which towers are near capacity?", "show me customers with repeat outages") replaces manual report-building.
- Where the ISP already has a billing system (including Splynx/DataTill), NetPulse AI connects to it rather than replacing it — positioning as complementary intelligence, not a rip-and-replace.

## 6. Self-Service Onboarding — Core Differentiator

**AI Migration Wizard, step by step:**

1. **Signup** — no sales call required.
2. **Type of ISP** — Fibre / WISP / Mixed / Enterprise (sets sensible defaults).
3. **Upload** — Excel, CSV, Google Sheets, or PDF exports (customers, IPs, routers, towers, technicians, billing).
4. **AI auto-detects entities** in the file — customer records, IP addresses, router serials, tower assets, billing lines — without a manual mapping step for common formats.
5. **AI proposes field mappings** for review (e.g. "Customer Name → Full Name — Accept?"); the ISP owner approves or edits in one click per field, not per row.
6. **AI validates & cleans** — flags duplicate IPs, missing customers, invalid IP formats, duplicate serials, broken subnet assignments — with suggested fixes before import.
7. **One-click import.**
8. **AI Health Report** — generated automatically, e.g.:
   > "We found 6 duplicate IP addresses, 18 devices with no assigned customer, 3 towers nearing capacity, 42 customers missing GPS locations, 12 expired warranties, 9 inactive routers still marked active."

This report is the "aha" moment and should be the centerpiece of every demo and every piece of marketing.

**Design rule for every future feature:** *"Can the AI do this instead of asking the user to do it?"* If yes, automate it.

## 7. Core Modules (Phased — see Execution Plan for sequencing)

**Phase 1 (MVP, build first):**
1. AI Migration Wizard (spreadsheet ingestion, mapping, validation, import)
2. AI Health Report generator
3. Customer records + basic IP address management (dedupe, allocation, search)
4. AI Copilot (natural-language Q&A over the imported data)

**Phase 2 (post-first-paying-customers):**
5. Technician job scheduling (mobile-friendly, offline-capable)
6. Equipment/asset tracking with warranty and assignment history
7. Basic fault ticketing

**Phase 3 (only once Phase 1–2 are proven and paid for):**
8. GIS network mapping
9. Network monitoring/SNMP integration (MikroTik, Ubiquiti first — they dominate the WISP segment)
10. Billing integrations (Splynx/DataTill connectors before building native billing)
11. Capacity planning, predictive analytics
12. Sales CRM, compliance/POPIA record-keeping

Do not attempt to build Phase 3 network monitoring or billing from scratch before Phase 1 has paying customers — this is where over-scoped ISP software projects die.

## 8. AI Agents (build incrementally, not all at once)

- **Migration/Health Agent** — powers the wizard and health report (build first)
- **Support Agent** — answers common customer questions (outage status, balance, router reset) — build once there's a live customer base to justify it
- **Inventory Agent, Growth Agent, Executive Agent, Network Operations Agent** — Phase 2/3, once core data model is stable

## 9. AI Copilot — Example Queries (v1 scope)

- "Which IP pools are nearly exhausted?"
- "Show me customers with repeated outages." *(requires fault data — Phase 2)*
- "Which towers are overloaded?" *(requires monitoring — Phase 3)*
- "Show me equipment without an assigned customer."

Scope the v1 Copilot to what Phase 1 data actually supports — don't promise capacity predictions before there's capacity data.

## 10. Technology Stack (adapted to your actual constraints — no GPU, no VPS budget)

- **Frontend:** Lovable.dev / Next.js, TypeScript, Tailwind
- **Backend/DB:** Supabase (Postgres, Auth, Edge Functions, Storage for uploaded spreadsheets)
- **AI inference:** Groq (Llama models) for the migration/mapping/health-report agent and Copilot — fast and cheap enough for a bootstrapped cost base; reserve Anthropic/OpenAI calls for the highest-value, lowest-frequency tasks (e.g. complex health report narrative generation) if Groq quality isn't sufficient there
- **Messaging/notifications:** Evolution API (WhatsApp), email
- **File parsing:** SheetJS/pandas-equivalent parsing in Edge Functions for xlsx/csv ingestion
- **Deployment:** Vercel/Supabase-hosted — no self-managed infrastructure required for v1

This keeps the MVP buildable solo, on your existing stack, with no infrastructure spend.

## 11. Business Model

**Self-service SaaS**, tiered by ISP size:

| Plan | Ideal Customer | Monthly Price (ZAR) |
|---|---|---|
| Starter | Small WISP (1–5 staff) | R999–R1,999 |
| Growth | Growing ISP (5–20 staff) | R3,999–R7,999 |
| Professional | Medium ISP (20–100 staff) | R9,999–R24,999 |
| Enterprise | Large ISP/FNO | Custom (R30,000+/month) |

**v1 focus: Starter and Growth only.** Professional/Enterprise pricing exists on the page for credibility but shouldn't be actively sold until Phase 2/3 modules exist to justify it.

No mandatory paid implementation fee in v1 — the whole point of the AI wizard is that self-service replaces the R10k–R50k onboarding fee model. Optional paid onboarding assistance can exist as a premium option for operators who want a human involved, not as a requirement.

## 12. Success Metrics (v1)

- Onboarding (signup → first AI Health Report) completed in under 15 minutes
- Spreadsheet import under 5 minutes for files up to ~5,000 rows
- 90%+ automatic field-mapping acceptance rate without manual correction
- First 10 paying customers acquired without a single manual onboarding call
- At least 3 of first 10 customers convert from "still using Excel" (the core ICP), not from a competitor switch

## 13. Long-Term Vision

Once the AI onboarding wedge has proven pull with small ISPs, NetPulse AI expands into the fuller operations platform (technician ops, GIS, monitoring, billing) — but always led by the AI layer as the reason to choose NetPulse AI over an established, feature-complete incumbent like Splynx or DataTill, not by trying to match their feature list module-for-module from day one.
