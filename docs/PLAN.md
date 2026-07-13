# NetPulse AI — Plan
**pla.md — Go-to-Market & Product Strategy**

---

## 1. The Wedge (why anyone switches from Excel to NetPulse AI specifically)

Every competitor (Splynx, DataTill, Netzur, XceedNet, WISPGate) sells "one platform to replace your spreadsheets." That message is saturated. Nobody is selling **"upload the mess you already have and watch AI make sense of it in 15 minutes, with zero setup calls."**

That is the entire wedge. Everything in the go-to-market should point at this single moment: **signup → upload → AI Health Report**, not at a full feature comparison against Splynx.

## 2. Who to sell to first (and who to ignore)

**Sell to:**
- WISPs/small fibre ISPs with 1–20 staff, still on Excel/Sheets, no dedicated ops software today. This is the group for whom Splynx/DataTill implementation feels heavy, and who are most likely to abandon a signup if there's a sales call in the way.

**Ignore for now:**
- ISPs already deep on Splynx/DataTill with years of historical data — a switch is a much harder sell and not where the AI-migration wedge shines.
- Enterprise/FNO — they need SLAs, integrations, and account management a solo operator can't yet deliver.

## 3. Positioning statement

*"NetPulse AI is the fastest way for a small South African ISP to go from spreadsheets to visibility — upload your files, get an AI health report in minutes, no sales call, no consultant."*

Not: "the all-in-one ISP operating system" (that's Splynx's and DataTill's claim, and they've earned it with years of feature depth — don't compete there yet).

## 4. Pricing Strategy

Keep v1 pricing simple and low-friction: **Starter (R999–R1,999/mo)** and **Growth (R3,999–R7,999/mo)** only, self-serve signup, credit card, no contract required for Starter. This matches the self-service positioning — a R30k enterprise deal with a procurement process contradicts "15 minutes, no sales call."

Revenue math to keep in view (not a promise, a planning input):
- 20 Starter/Growth customers averaging R3,000/mo → R60,000 MRR
- 50 customers averaging R4,000/mo → R200,000 MRR
- These are realistic near-term targets for a wedge product; the R750k–R2M MRR scenarios in the original draft assume Professional/Enterprise penetration that's a Phase 3 conversation, not a v1 plan.

## 5. Distribution — how first customers actually get found

Given no ad budget, distribution has to be founder-led and signal-based, not broad marketing:

1. **Lead generation via buying-signal research** (see the Base44 agent prompt — this is the primary top-of-funnel mechanism: identify South African WISPs/ISPs actively showing pain — hiring ops staff, complaint patterns, visible growth — before they've evaluated any software.
2. **Direct outreach**, personalized to the specific pain signal found (not a generic pitch).
3. **Free AI Health Report as the sales tool itself** — instead of a demo call, offer to run their actual spreadsheet through the wizard and hand back the health report. This is a stronger proof point than any deck, and mirrors how the product should be sold: show, don't pitch.
4. **WISPA / ISP community channels** (industry forums, WhatsApp groups, LinkedIn groups for South African network operators) — organic presence, not paid.

## 6. Risks and how this plan addresses them

| Risk | Mitigation in this plan |
|---|---|
| Established competitors (Splynx, DataTill) have years of feature depth | Don't compete on feature count; compete on the AI onboarding moment and target the segment competitors underserve (smallest WISPs) |
| Solo/small team, no infra budget | Phased module build (Section 7 of PRD) — ship only what the wedge needs first |
| "AI health report" quality depends on messy real-world spreadsheets | Test the wizard against real anonymized ISP spreadsheets (ask early prospects to share a sample) before wide launch — this is the single highest-risk technical component |
| No existing customer base or case studies | First 5–10 customers should be treated as design partners — discounted or free in exchange for a testimonial and a case study, mirroring how Splynx built its published case studies |

## 7. What "done" looks like for v1

Not a 12-module platform. Done = a working AI Migration Wizard + Health Report + Copilot, live with 10 paying small-ISP customers, at least one public case study, before a single hour is spent on GIS, network monitoring, or native billing.
