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

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
  }

  const allowedTypes = ["fibre", "wireless", "mixed", "enterprise"];
  if (!ispType || !allowedTypes.includes(ispType)) {
    return NextResponse.json({ error: "Invalid ISP type." }, { status: 400 });
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: name.trim(), isp_type: ispType })
    .select()
    .single();

  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 });
  }

  const { error: memberError } = await supabase.from("organization_members").insert({
    organization_id: org.id,
    user_id: user.id,
    role: "owner",
  });

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ organization: org });
}
