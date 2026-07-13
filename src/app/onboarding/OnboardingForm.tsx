"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ISP_TYPES = [
  { value: "fibre", label: "Fibre" },
  { value: "wireless", label: "Wireless (WISP)" },
  { value: "mixed", label: "Mixed" },
  { value: "enterprise", label: "Enterprise / Private network" },
];

export default function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [ispType, setIspType] = useState("wireless");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ispType }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      setLoading(false);
      return;
    }

    router.push("/onboarding/upload");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="name" className="text-sm block mb-1.5">
          ISP / company name
        </label>
        <input
          id="name"
          required
          className="input-field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Highveld Wireless"
        />
      </div>

      <div>
        <span className="text-sm block mb-2">Network type</span>
        <div className="grid grid-cols-2 gap-2">
          {ISP_TYPES.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => setIspType(t.value)}
              className="text-sm text-left px-3 py-2.5 rounded-lg border transition-colors"
              style={{
                borderColor: ispType === t.value ? "var(--signal)" : "var(--border)",
                background: ispType === t.value ? "var(--bg-raised)" : "transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Setting up…" : "Continue to upload"}
      </button>
    </form>
  );
}
