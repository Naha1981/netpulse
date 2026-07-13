import { redirect } from "next/navigation";
import { getCurrentOrganization } from "@/lib/org";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  const org = await getCurrentOrganization();

  // Already onboarded — send straight to the upload wizard.
  if (org) {
    redirect("/onboarding/upload");
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--signal)" }}>
          Step 1 of 2
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Tell us about your ISP
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
          This sets sensible defaults — you can change it later.
        </p>
        <OnboardingForm />
      </div>
    </main>
  );
}
