import { groqJson } from "./groqClient";
import type { ParsedSpreadsheet } from "@/lib/parsing/parseSpreadsheet";

export type EntityType =
  | "customers"
  | "ip_addresses"
  | "equipment"
  | "unknown";

// The canonical fields we know how to import for each entity type.
// The AI is constrained to only propose mappings into these — it cannot
// invent new destination columns, which keeps the import path safe.
export const TARGET_SCHEMAS: Record<Exclude<EntityType, "unknown">, string[]> = {
  customers: [
    "full_name",
    "email",
    "phone",
    "physical_address",
    "gps_lat",
    "gps_lng",
    "service_plan",
    "status",
  ],
  ip_addresses: [
    "ip_address",
    "subnet",
    "device_serial",
    "is_reserved",
  ],
  equipment: [
    "device_type",
    "serial_number",
    "brand",
    "warranty_expiry",
    "is_active",
  ],
};

export interface FieldMappingProposal {
  entity_type: EntityType;
  confidence: number; // 0-1
  reasoning: string;
  field_mappings: {
    source_column: string;
    target_field: string | null; // null = "no confident match, leave unmapped"
  }[];
}

const SYSTEM_PROMPT = `You are the data-mapping engine inside NetPulse AI, a product that lets ISP owners import operational spreadsheets without manually mapping columns themselves.

Given a spreadsheet's column headers and a small sample of rows, you must:
1. Decide which ONE entity type this spreadsheet represents: "customers", "ip_addresses", "equipment", or "unknown" if it doesn't clearly match any.
2. Propose a mapping from each source column to the closest matching target field for that entity type. If a source column has no confident match, set target_field to null — never force a bad mapping.
3. Give a confidence score from 0 to 1 for your overall entity-type detection.
4. Give a one-sentence reasoning for a human to sanity-check.

You must only use target_field values from the allowed list you're given for the detected entity type. Respond ONLY with strict JSON matching this shape:
{
  "entity_type": "customers" | "ip_addresses" | "equipment" | "unknown",
  "confidence": 0.0-1.0,
  "reasoning": "short string",
  "field_mappings": [ { "source_column": "string", "target_field": "string or null" } ]
}`;

export async function proposeMapping(
  parsed: ParsedSpreadsheet
): Promise<FieldMappingProposal> {
  const userPrompt = `Column headers: ${JSON.stringify(parsed.headers)}

Sample rows (up to 15):
${JSON.stringify(parsed.sampleRows, null, 2)}

Allowed target fields per entity type:
${JSON.stringify(TARGET_SCHEMAS, null, 2)}

Return the JSON object described in your instructions.`;

  const result = await groqJson<FieldMappingProposal>({
    system: SYSTEM_PROMPT,
    user: userPrompt,
  });

  // Defensive validation: strip any target_field the model hallucinated
  // outside the allowed schema, rather than trusting it blindly.
  if (result.entity_type !== "unknown") {
    const allowed = new Set(TARGET_SCHEMAS[result.entity_type]);
    result.field_mappings = result.field_mappings.map((m) => ({
      ...m,
      target_field: m.target_field && allowed.has(m.target_field) ? m.target_field : null,
    }));
  } else {
    result.field_mappings = result.field_mappings.map((m) => ({
      ...m,
      target_field: null,
    }));
  }

  return result;
}
