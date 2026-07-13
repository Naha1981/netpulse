import { groqJson } from "./groqClient";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Design decision: the LLM never writes or executes SQL directly against
 * customer data. It only classifies the user's question into one of a
 * fixed set of supported intents (below), and the server runs a safe,
 * parameterized query for that intent. This bounds the Copilot to what
 * Phase 1 data actually supports (per the PRD) and removes any prompt-
 * injection or data-exfiltration risk from a malicious upload/question.
 */

export type CopilotIntent =
  | "equipment_without_customer"
  | "duplicate_ip_addresses"
  | "expiring_warranties"
  | "ip_usage_summary"
  | "customer_count_by_status"
  | "unsupported";

const SUPPORTED_INTENTS: { intent: CopilotIntent; description: string }[] = [
  {
    intent: "equipment_without_customer",
    description: "Equipment/devices that have no customer assigned",
  },
  {
    intent: "duplicate_ip_addresses",
    description: "IP addresses assigned to more than one record",
  },
  {
    intent: "expiring_warranties",
    description: "Equipment warranties that have expired or expire soon",
  },
  {
    intent: "ip_usage_summary",
    description: "How many IP addresses are allocated vs. reserved vs. free",
  },
  {
    intent: "customer_count_by_status",
    description: "How many customers are active, suspended, or cancelled",
  },
];

const CLASSIFY_SYSTEM_PROMPT = `You classify a question an ISP owner asks NetPulse AI's Copilot into exactly one supported intent. Supported intents:
${SUPPORTED_INTENTS.map((i) => `- ${i.intent}: ${i.description}`).join("\n")}

If the question doesn't clearly match one of these (e.g. it asks about network monitoring, GIS, technician jobs, or billing — none of which exist in Phase 1 data), classify it as "unsupported".

Respond ONLY with strict JSON: { "intent": "one of the intents above" }`;

export async function classifyIntent(question: string): Promise<CopilotIntent> {
  const { intent } = await groqJson<{ intent: CopilotIntent }>({
    system: CLASSIFY_SYSTEM_PROMPT,
    user: question,
  });
  const valid = SUPPORTED_INTENTS.some((i) => i.intent === intent);
  return valid ? intent : "unsupported";
}

interface IntentResult {
  data: unknown;
  narrationContext: string;
}

async function runIntent(
  supabase: SupabaseClient,
  organizationId: string,
  intent: CopilotIntent
): Promise<IntentResult> {
  switch (intent) {
    case "equipment_without_customer": {
      const { data, error } = await supabase
        .from("equipment")
        .select("device_type, serial_number, brand")
        .eq("organization_id", organizationId)
        .is("customer_id", null)
        .limit(50);
      if (error) throw error;
      return {
        data,
        narrationContext: `${data?.length ?? 0} equipment records with no assigned customer (showing up to 50).`,
      };
    }

    case "duplicate_ip_addresses": {
      const { data, error } = await supabase
        .from("ip_addresses")
        .select("ip_address")
        .eq("organization_id", organizationId);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        counts.set(row.ip_address, (counts.get(row.ip_address) ?? 0) + 1);
      }
      const dupes = [...counts.entries()].filter(([, c]) => c > 1);
      return {
        data: dupes.map(([ip, count]) => ({ ip_address: ip, count })),
        narrationContext: `${dupes.length} IP addresses assigned more than once.`,
      };
    }

    case "expiring_warranties": {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + 60); // next 60 days, plus anything already expired
      const { data, error } = await supabase
        .from("equipment")
        .select("device_type, serial_number, warranty_expiry")
        .eq("organization_id", organizationId)
        .lte("warranty_expiry", cutoff.toISOString().slice(0, 10))
        .not("warranty_expiry", "is", null)
        .order("warranty_expiry", { ascending: true })
        .limit(50);
      if (error) throw error;
      return {
        data,
        narrationContext: `${data?.length ?? 0} equipment records with warranties expired or expiring within 60 days.`,
      };
    }

    case "ip_usage_summary": {
      const { count: total, error: e1 } = await supabase
        .from("ip_addresses")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId);
      const { count: reserved, error: e2 } = await supabase
        .from("ip_addresses")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("is_reserved", true);
      const { count: assigned, error: e3 } = await supabase
        .from("ip_addresses")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .not("customer_id", "is", null);
      if (e1 || e2 || e3) throw e1 || e2 || e3;
      return {
        data: { total, reserved, assigned },
        narrationContext: `${total ?? 0} total IPs tracked, ${assigned ?? 0} assigned to customers, ${reserved ?? 0} reserved.`,
      };
    }

    case "customer_count_by_status": {
      const { data, error } = await supabase
        .from("customers")
        .select("status")
        .eq("organization_id", organizationId);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.status] = (counts[row.status] ?? 0) + 1;
      }
      return { data: counts, narrationContext: JSON.stringify(counts) };
    }

    default:
      return { data: null, narrationContext: "unsupported" };
  }
}

const ANSWER_SYSTEM_PROMPT = `You are NetPulse AI's Copilot. You've been given the exact result of a database query already run for the ISP owner's question. Write a short, direct answer (1-3 sentences) using only the numbers/data given — never invent or round in a way that changes the meaning. If the data list is empty, say so plainly and note that's good news where relevant (e.g. no duplicates found). Respond ONLY with strict JSON: { "answer": "string" }`;

export async function answerCopilotQuestion(
  supabase: SupabaseClient,
  organizationId: string,
  question: string
): Promise<{ intent: CopilotIntent; answer: string; data: unknown }> {
  const intent = await classifyIntent(question);

  if (intent === "unsupported") {
    return {
      intent,
      answer:
        "I can't answer that yet — Phase 1 of NetPulse AI covers customers, IP addresses, and equipment. Questions about network monitoring, technician jobs, or billing will work once those modules are added.",
      data: null,
    };
  }

  const result = await runIntent(supabase, organizationId, intent);

  const { answer } = await groqJson<{ answer: string }>({
    system: ANSWER_SYSTEM_PROMPT,
    user: JSON.stringify({
      question,
      queryResultSummary: result.narrationContext,
      data: result.data,
    }),
  });

  return { intent, answer, data: result.data };
}
