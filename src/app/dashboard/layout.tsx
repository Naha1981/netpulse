import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOrganization } from "@/lib/org";
import LogoutButton from "./LogoutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const org = await getCurrentOrganization();
  if (!org) {
    redirect("/onboarding");
  }

  return (
    <div className="flex-1 flex flex-col">
      <header
        className="border-b px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 whitespace-nowrap">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: "var(--signal)" }}
            />
            <span className="font-semibold tracking-tight">NetPulse AI</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm" style={{ color: "var(--text-dim)" }}>
            <Link href="/dashboard">Overview</Link>
            <Link href="/dashboard/copilot">Copilot</Link>
            <Link href="/onboarding/upload">Import data</Link>
          </nav>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm" style={{ color: "var(--text-dim)" }}>
            {org.name}
          </span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
