import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseSpreadsheet } from "@/lib/parsing/parseSpreadsheet";
import {
  validateIpAddresses,
  validateRequiredField,
  validateDuplicateSerials,
  validateExpiredWarranties,
  type ValidationFinding,
} from "@/lib/ai/validate";
import { generateHealthReport } from "@/lib/ai/healthReport";
import type { EntityType } from "@/lib/ai/mapping";

export const maxDuration = 60;

interface ApprovedMapping {
  source_column: string;
  target_field: string | null;
}

const TABLE_BY_ENTITY: Record<Exclude<EntityType, "unknown">, string> = {
  customers: "customers",
  ip_addresses: "ip_addresses",
  equipment: "equipment",
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json();
  const {
    uploadId,
    entityType,
    fieldMappings,
  }: {
    uploadId: string;
    entityType: Exclude<EntityType, "unknown">;
    fieldMappings: ApprovedMapping[];
  } = body;

  if (!uploadId || !entityType || !fieldMappings) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (!TABLE_BY_ENTITY[entityType]) {
    return NextResponse.json({ error: "Unsupported entity type." }, { status: 400 });
  }

  const { data: uploadRow, error: uploadFetchError } = await supabase
    .from("uploads")
    .select("*")
    .eq("id", uploadId)
    .single();

  if (uploadFetchError || !uploadRow) {
    return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  }

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("uploads")
    .download(uploadRow.storage_path);

  if (downloadError || !fileBlob) {
    return NextResponse.json(
      { error: "Could not retrieve the original file for import." },
      { status: 500 }
    );
  }

  const arrayBuffer = await fileBlob.arrayBuffer();
  let parsed;
  try {
    parsed = parseSpreadsheet(arrayBuffer, uploadRow.original_filename);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not re-parse file." },
      { status: 500 }
    );
  }

  // Build a source_column -> target_field lookup from the approved mapping,
  // ignoring any column the user left unmapped.
  const columnMap = new Map<string, string>();
  for (const m of fieldMappings) {
    if (m.target_field) columnMap.set(m.source_column, m.target_field);
  }

  const normalizedRows = parsed.rows.map((row) => {
    const record: Record<string, unknown> = {
      organization_id: uploadRow.organization_id,
      source_upload_id: uploadId,
    };
    for (const [sourceCol, targetField] of columnMap.entries()) {
      const value = row[sourceCol];
      record[targetField] = value === "" ? null : value;
    }
    return record;
  });

  // Coerce a couple of known boolean/numeric fields so we don't hand the
  // DB a string where it expects a bool/number.
  for (const record of normalizedRows) {
    if ("is_reserved" in record) {
      record.is_reserved = truthy(record.is_reserved);
    }
    if ("is_active" in record) {
      record.is_active = record.is_active === undefined ? true : truthy(record.is_active);
    }
    if ("gps_lat" in record) record.gps_lat = toNumberOrNull(record.gps_lat);
    if ("gps_lng" in record) record.gps_lng = toNumberOrNull(record.gps_lng);
  }

  // Run deterministic validation appropriate to the entity type BEFORE
  // insert, so the health report reflects the data as uploaded.
  let findings: ValidationFinding[] = [];
  if (entityType === "ip_addresses") {
    findings = [
      ...validateIpAddresses(normalizedRows as { ip_address?: unknown }[]),
    ];
  } else if (entityType === "customers") {
    findings = [
      ...validateRequiredField(normalizedRows, "full_name", "customer"),
    ];
  } else if (entityType === "equipment") {
    findings = [
      ...validateDuplicateSerials(normalizedRows as { serial_number?: unknown }[]),
      ...validateExpiredWarranties(normalizedRows as { warranty_expiry?: unknown }[]),
    ];
  }

  const table = TABLE_BY_ENTITY[entityType];

  // Insert in batches to stay well under request/payload limits.
  const BATCH_SIZE = 500;
  for (let i = 0; i < normalizedRows.length; i += BATCH_SIZE) {
    const batch = normalizedRows.slice(i, i + BATCH_SIZE);
    const { error: insertError } = await supabase.from(table).insert(batch);
    if (insertError) {
      await supabase
        .from("uploads")
        .update({ status: "failed" })
        .eq("id", uploadId);
      return NextResponse.json(
        { error: `Import failed while writing rows: ${insertError.message}` },
        { status: 500 }
      );
    }
  }

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", uploadRow.organization_id)
    .single();

  let healthReport;
  try {
    healthReport = await generateHealthReport(findings, {
      organizationName: orgRow?.name ?? "your organization",
      entityType,
      rowCount: normalizedRows.length,
    });
  } catch {
    // Import already succeeded — a health-report narrative failure
    // shouldn't roll back real data. Fall back to a plain summary.
    healthReport = {
      summary: `Imported ${normalizedRows.length} ${entityType} records. ${findings.length} data-quality issue${findings.length === 1 ? "" : "s"} found — see details below.`,
      findings,
    };
  }

  const { data: reportRow, error: reportInsertError } = await supabase
    .from("health_reports")
    .insert({
      organization_id: uploadRow.organization_id,
      upload_id: uploadId,
      summary: healthReport.summary,
      findings: healthReport.findings,
    })
    .select()
    .single();

  if (reportInsertError) {
    return NextResponse.json({ error: reportInsertError.message }, { status: 500 });
  }

  await supabase.from("uploads").update({ status: "imported" }).eq("id", uploadId);

  return NextResponse.json({ healthReport: reportRow });
}

function truthy(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const s = String(value ?? "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1";
}

function toNumberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
