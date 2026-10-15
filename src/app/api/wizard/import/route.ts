import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseSpreadsheet } from "@/lib/parsing/parseSpreadsheet";
import { prepareImport, type ImportEntity } from "@/lib/parsing/normalizeImport";
import { generateHealthReport } from "@/lib/ai/healthReport";
import type { EntityType } from "@/lib/ai/mapping";

export const maxDuration = 60;

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
    fieldMappings: unknown;
  } = body;

  if (!uploadId || !entityType || !fieldMappings) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (!["customers", "ip_addresses", "equipment"].includes(entityType)) {
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

  if (uploadRow.status === "imported") {
    const { data: report, error } = await supabase.from("health_reports").select("*").eq("upload_id", uploadId).single();
    if (error) return NextResponse.json({ error: "Imported upload is missing its report." }, { status: 409 });
    return NextResponse.json({ healthReport: report });
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

  let prepared;
  try {
    const parsed = parseSpreadsheet(await fileBlob.arrayBuffer(), uploadRow.original_filename);
    prepared = prepareImport(parsed, entityType as ImportEntity, fieldMappings);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid import." }, { status: 400 });
  }
  const { rows: normalizedRows, findings } = prepared;

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

  const { data: reportRow, error } = await supabase.rpc("commit_import", {
    p_upload_id: uploadId,
    p_entity: entityType,
    p_rows: normalizedRows,
    p_summary: healthReport.summary,
    p_findings: findings,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ healthReport: reportRow });
}
