import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseSpreadsheet } from "@/lib/parsing/parseSpreadsheet";
import { proposeMapping } from "@/lib/ai/mapping";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const organizationId = formData.get("organizationId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (!organizationId) {
    return NextResponse.json({ error: "Missing organizationId." }, { status: 400 });
  }

  const allowedExtensions = [".xlsx", ".xls", ".csv"];
  const hasAllowedExtension = allowedExtensions.some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  );
  if (!hasAllowedExtension) {
    return NextResponse.json(
      { error: "Only .xlsx, .xls, and .csv files are supported." },
      { status: 400 }
    );
  }

  const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Phase 1 supports files up to 15MB." },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();

  let parsed;
  try {
    parsed = parseSpreadsheet(arrayBuffer, file.name);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not parse this file." },
      { status: 400 }
    );
  }

  const storagePath = `${organizationId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("uploads")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  let proposal;
  try {
    proposal = await proposeMapping(parsed);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `AI mapping failed: ${err.message}`
            : "AI mapping failed.",
      },
      { status: 502 }
    );
  }

  const { data: uploadRow, error: insertError } = await supabase
    .from("uploads")
    .insert({
      organization_id: organizationId,
      storage_path: storagePath,
      original_filename: file.name,
      detected_entity_type: proposal.entity_type,
      status: "analyzed",
      row_count: parsed.totalRowCount,
      mapping_proposal: proposal,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    uploadId: uploadRow.id,
    proposal,
    headers: parsed.headers,
    sampleRows: parsed.sampleRows,
    totalRowCount: parsed.totalRowCount,
  });
}
