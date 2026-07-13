import { redirect } from "next/navigation";
import { getCurrentOrganization } from "@/lib/org";
import UploadWizard from "./UploadWizard";

export default async function UploadPage() {
  const org = await getCurrentOrganization();
  if (!org) {
    redirect("/onboarding");
  }

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--signal)" }}>
          Step 2 of 2
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Upload your spreadsheet
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
          Customers, IP addresses, or equipment — one file at a time. Excel,
          CSV, or a Google Sheets export.
        </p>

        <UploadWizard organizationId={org.id} />
      </div>
    </main>
  );
}
