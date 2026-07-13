import { groqJson } from "./groqClient";
import type { ValidationFinding } from "./validate";

export interface HealthReport {
  summary: string;
  findings: ValidationFinding[];
}

const SYSTEM_PROMPT = `You write the AI Health Report shown to an ISP owner immediately after they import a spreadsheet into NetPulse AI. This is the single most important moment in the product — it has to feel like the AI genuinely understood their business in minutes.

You are given a structured list of data-quality findings (already computed exactly — do not invent numbers, do not change any count). Write a short summary (3-5 sentences) in plain, direct language, ordered roughly by severity, that:
- states what was found, using the exact counts given
- explains briefly why each matters operationally (not academically)
- ends with one encouraging, concrete next step

Do not use marketing language ("unlock", "revolutionize", "seamless"). Write like a competent operations person handing over a findings memo, not an ad. Respond ONLY with strict JSON: { "summary": "string" }`;

/**
 * Findings are computed deterministically by validate.ts and passed in
 * here unchanged — the AI only ever writes the narrative around them,
 * it never generates or alters the numbers themselves.
 */
export async function generateHealthReport(
  findings: ValidationFinding[],
  context: { organizationName: string; entityType: string; rowCount: number }
): Promise<HealthReport> {
  if (findings.length === 0) {
    return {
      summary: `We reviewed ${context.rowCount} ${context.entityType} records from your import and found no data-quality issues — no duplicates, no missing required fields, nothing flagged. This dataset is clean and ready to use.`,
      findings: [],
    };
  }

  const { summary } = await groqJson<{ summary: string }>({
    system: SYSTEM_PROMPT,
    user: JSON.stringify({
      organization: context.organizationName,
      entity_type: context.entityType,
      row_count: context.rowCount,
      findings,
    }),
  });

  return { summary, findings };
}
