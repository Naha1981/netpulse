import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/org";

export default async function DashboardPage() {
  const org = await getCurrentOrganization();
  if (!org) return null;

  const supabase = await createClient();

  const [{ count: customerCount }, { count: ipCount }, { count: equipmentCount }, { data: latestReport }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", org.id),
      supabase
        .from("ip_addresses")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", org.id),
      supabase
        .from("equipment")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", org.id),
      supabase
        .from("health_reports")
        .select("*")
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const hasData = (customerCount ?? 0) + (ipCount ?? 0) + (equipmentCount ?? 0) > 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>

      {!hasData ? (
        <div className="card p-8 mt-8 text-center">
          <p className="font-medium">No data imported yet</p>
          <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
            Upload a spreadsheet to get your first AI Health Report.
          </p>
          <Link href="/onboarding/upload" className="btn-primary inline-block mt-5">
            Import your first spreadsheet
          </Link>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            <StatCard label="Customers" value={customerCount ?? 0} />
            <StatCard label="IP addresses" value={ipCount ?? 0} />
            <StatCard label="Equipment records" value={equipmentCount ?? 0} />
          </div>

          {latestReport && (
            <div className="card p-6 mt-6">
              <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--signal)" }}>
                Latest AI Health Report
              </p>
              <p className="mt-3 text-sm leading-relaxed">{latestReport.summary}</p>
            </div>
          )}

          <Link href="/onboarding/upload" className="btn-secondary inline-block mt-6">
            Import another file
          </Link>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <p className="text-sm" style={{ color: "var(--text-dim)" }}>
        {label}
      </p>
      <p className="mono text-3xl mt-1">{value.toLocaleString()}</p>
    </div>
  );
}
