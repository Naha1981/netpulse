# NetPulse AI — Execution Plan

Scope: solo/small-team build, zero infrastructure budget, existing stack (Lovable/Next.js, Supabase, Groq, Evolution API). Sequenced so revenue-critical pieces ship first.

---

## Phase 0 — Validation (before writing product code)

**Goal:** confirm the AI wizard is technically feasible against real messy data, and that at least a few real ISPs want this, before building the full app shell.

1. Collect 3–5 real (anonymized) ISP spreadsheets — ask contacts, forums, or your own outreach targets ("can I test my import tool on a sample export, no obligation?").
2. Build a throwaway script (not the product) that takes an xlsx/csv, sends structure + sample rows to Groq, and returns: detected entity type, proposed field mappings, and a list of data-quality issues (dupes, missing fields, invalid IPs).
3. Manually score the output against what a human would expect. If mapping accuracy is poor on real files, fix the prompting/approach here — this is the core IP of the product, and it's the cheapest place to fail.
4. Only proceed to Phase 1 once this consistently produces a usable, correct-feeling health report on real data.

**Exit criteria:** 90%+ field-mapping accuracy on 3+ real sample files without hand-tuning per file.

---

## Phase 1 — MVP Build (target: 3–5 weeks solo)

**Week 1: Foundation**
- Supabase project: auth, Postgres schema for customers, IP addresses, equipment, uploads
- Signup flow (no sales gate) → ISP type selection
- File upload to Supabase Storage (xlsx/csv/PDF)

**Week 2: AI Migration Wizard core**
- Edge Function: parse uploaded file → extract structure/sample rows
- Groq call: entity detection + field mapping proposal (reuse Phase 0 script, productionize it)
- Mapping review UI (accept/edit per field, not per row)
- Import execution: write mapped rows into schema, run validation (dupe IP detection, missing-field detection, invalid IP format check)

**Week 3: AI Health Report + Copilot v1**
- Health report generation (template + Groq-generated narrative from validation results)
- Health report UI — this is the demo centerpiece, invest polish here
- Copilot v1: natural-language query → Groq → SQL-safe query against Supabase → formatted answer (scope to the 3-4 query types the Phase 1 data actually supports)

**Week 4: Billing + basic customer/IP management UI**
- Stripe/Paystack or local ZAR payment integration for Starter/Growth self-serve signup
- Customer list view, IP address list view with dedupe flags
- Basic account settings, plan selection

**Week 5: Polish + first design partners**
- Fix issues found running real prospect spreadsheets through the wizard
- Onboard 2-3 free/discounted design-partner ISPs (from outreach in Plan Section 6)
- Collect first testimonial/case study material

**Exit criteria:** a stranger can sign up, upload a real spreadsheet, and get a correct-feeling AI Health Report with zero help from you, in under 15 minutes.

---

## Phase 2 — Post-First-Revenue (only after Phase 1 has paying customers)

- Technician job scheduling (mobile-friendly)
- Equipment/asset tracking with warranty tracking
- Basic fault ticketing
- Support Agent (WhatsApp via Evolution API) for common customer queries

Trigger to start Phase 2: 10+ paying customers on Phase 1, or explicit paid demand for one of these modules from an active customer.

---

## Phase 3 — Platform Expansion (only once Phase 1–2 are proven)

- GIS network mapping
- SNMP network monitoring (MikroTik/Ubiquiti first)
- Splynx/DataTill billing connectors (before native billing)
- Capacity planning, predictive analytics
- Sales CRM, POPIA compliance record-keeping

Trigger to start Phase 3: R50k+ MRR from Phase 1/2, or a specific Professional/Enterprise prospect requiring it to close.

---

## Explicit anti-scope-creep rule

Do not start Phase 2 work while Phase 1 has zero paying customers. Do not start Phase 3 work while Phase 2 has zero paying customers. This mirrors the core strategic diagnosis already on record: the gap is closing deals on what exists, not building more.

## Weekly operating rhythm during build

- Ship something demoable every week, even if rough — a working wizard beats a polished landing page.
- Run at least one real prospect's spreadsheet through the wizard every week starting Phase 0, not just at the end — this is both QA and a sales touchpoint.
- Track every prospect touched in The Ledger (existing pipeline tracker), including NetPulse AI leads from the Base44 agent below, under the same five-business-day follow-up rule.
