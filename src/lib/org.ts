import { createClient } from "@/lib/supabase/server";

export interface Organization {
  id: string;
  name: string;
  isp_type: string;
  plan: string;
  created_at: string;
}

/**
 * Returns the first organization the current user belongs to, or null.
 * Phase 1 assumes one organization per user (the common case for a small
 * ISP owner) — multi-org switching can be added later without changing
 * the data model, since membership is already a join table.
 */
export async function getCurrentOrganization(): Promise<Organization | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", membership.organization_id)
    .single();

  return org as Organization | null;
}
