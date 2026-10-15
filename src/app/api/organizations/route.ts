import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json();
  const { name, ispType } = body as { name?: string; ispType?: string };

  if (typeof name !== "string" || !name.trim() || name.length > 200) {
    return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
  }

  const allowedTypes = ["fibre", "wireless", "mixed", "enterprise"];
  if (!ispType || !allowedTypes.includes(ispType)) {
    return NextResponse.json({ error: "Invalid ISP type." }, { status: 400 });
  }

  const { data: org, error } = await supabase.rpc("create_organization", {
    p_name: name.trim(),
    p_isp_type: ispType,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ organization: org });
}
