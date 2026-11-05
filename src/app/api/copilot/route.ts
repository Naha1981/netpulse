import { sameOrigin } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { answerCopilotQuestion } from "@/lib/ai/copilot";

export async function POST(request: NextRequest) {
  if(!sameOrigin(request)) return NextResponse.json({error:"Invalid request origin"},{status:403});
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { organizationId, question } = await request.json();

  if (!organizationId || !question || !String(question).trim()) {
    return NextResponse.json(
      { error: "organizationId and question are required." },
      { status: 400 }
    );
  }

  if(typeof question!=="string"||question.length>2000)return NextResponse.json({error:"Question must be 1-2000 characters."},{status:400});
  const {data:membership}=await supabase.from("organization_members").select("id").eq("user_id",user.id).eq("organization_id",organizationId).maybeSingle();
  if(!membership)return NextResponse.json({error:"Organization not found."},{status:404});
  // RLS on every table queried inside answerCopilotQuestion enforces that
  // this user can only ever see rows from organizations they belong to —
  // organizationId here is a filter, not a trust boundary.
  try {
    const result = await answerCopilotQuestion(
      supabase,
      organizationId,
      String(question).trim()
    );

    await supabase.from("copilot_queries").insert({
      organization_id: organizationId,
      user_id: user.id,
      question: String(question).trim(),
      intent: result.intent,
      answer: result.answer,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Copilot failed to answer." },
      { status: 502 }
    );
  }
}
