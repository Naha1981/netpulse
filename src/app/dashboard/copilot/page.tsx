import { getCurrentOrganization } from "@/lib/org";
import CopilotChat from "./CopilotChat";

export default async function CopilotPage() {
  const org = await getCurrentOrganization();
  if (!org) return null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Copilot</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
        Ask about your customers, IP addresses, or equipment. Phase 1 covers
        those three data types — network monitoring and billing questions
        will work once those modules ship.
      </p>
      <CopilotChat organizationId={org.id} />
    </div>
  );
}
