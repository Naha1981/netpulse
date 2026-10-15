"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type EntityType = "customers" | "ip_addresses" | "equipment" | "unknown";

const TARGET_SCHEMAS: Record<Exclude<EntityType, "unknown">, string[]> = {
  customers: [
    "full_name",
    "email",
    "phone",
    "physical_address",
    "gps_lat",
    "gps_lng",
    "service_plan",
    "status",
  ],
  ip_addresses: ["ip_address", "subnet", "device_serial", "is_reserved"],
  equipment: ["device_type", "serial_number", "brand", "warranty_expiry", "is_active"],
};

interface FieldMapping {
  source_column: string;
  target_field: string | null;
}

interface Proposal {
  entity_type: EntityType;
  confidence: number;
  reasoning: string;
  field_mappings: FieldMapping[];
}

interface Finding {
  type: string;
  count: number;
  description: string;
  severity: "high" | "medium" | "low";
  sampleValues?: string[];
}

interface HealthReport {
  summary: string;
  findings: Finding[];
}

type Step = "select" | "review" | "importing" | "done";

export default function UploadWizard({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("select");
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [uploadId, setUploadId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [totalRowCount, setTotalRowCount] = useState(0);
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);

  async function handleFileSelected(file: File) {
    setError(null);
    setAnalyzing(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("organizationId", organizationId);

    try {
      const res = await fetch("/api/wizard/analyze", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Analysis failed.");

      setUploadId(json.uploadId);
      setProposal(json.proposal);
      setTotalRowCount(json.totalRowCount);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateMapping(index: number, targetField: string | null) {
    if (!proposal) return;
    const next = [...proposal.field_mappings];
    next[index] = { ...next[index], target_field: targetField };
    setProposal({ ...proposal, field_mappings: next });
  }

  async function handleConfirmImport() {
    if (!proposal || !uploadId || proposal.entity_type === "unknown") return;
    setStep("importing");
    setError(null);

    try {
      const res = await fetch("/api/wizard/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId,
          entityType: proposal.entity_type,
          fieldMappings: proposal.field_mappings,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed.");

      setHealthReport(json.healthReport);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStep("review");
    }
  }

  return (
    <div className="mt-8">
      <div className="card p-4 mb-6 text-sm">
        <p>Start with synthetic sample files. Uploaded sample rows are sent to Groq for column mapping. Do not upload personal or customer data yet.</p>
        <div className="flex flex-wrap gap-4 mt-3" style={{color:"var(--signal)"}}>
          <a href="/samples/customers.csv" download>Customer sample</a>
          <a href="/samples/ip-addresses.csv" download>IP sample</a>
          <a href="/samples/equipment.csv" download>Equipment sample</a>
        </div>
      </div>
      {step === "select" && (
        <FileDropZone onFile={handleFileSelected} analyzing={analyzing} />
      )}

      {step === "review" && proposal && (
        <MappingReview
          proposal={proposal}
          totalRowCount={totalRowCount}
          onChangeMapping={updateMapping}
          onConfirm={handleConfirmImport}
          onCancel={() => {
            setStep("select");
            setProposal(null);
          }}
        />
      )}

      {step === "importing" && (
        <div className="card p-8 text-center">
          <p className="mono text-sm" style={{ color: "var(--signal)" }}>
            Importing and analyzing your data…
          </p>
        </div>
      )}

      {step === "done" && healthReport && (
        <HealthReportView
          report={healthReport}
          onImportAnother={() => {
            setStep("select");
            setProposal(null);
            setHealthReport(null);
          }}
          onGoToDashboard={() => router.push("/dashboard")}
        />
      )}

      {error && (
        <p className="mt-4 text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function FileDropZone({
  onFile,
  analyzing,
}: {
  onFile: (file: File) => void;
  analyzing: boolean;
}) {
  return (
    <label
      className="card flex flex-col items-center justify-center gap-3 py-16 cursor-pointer border-dashed"
      style={{ borderStyle: "dashed" }}
    >
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        disabled={analyzing}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      {analyzing ? (
        <p className="mono text-sm" style={{ color: "var(--signal)" }}>
          Reading your file…
        </p>
      ) : (
        <>
          <p className="font-medium">Click to choose a file</p>
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            .xlsx, .xls, or .csv — up to 15MB
          </p>
        </>
      )}
    </label>
  );
}

function MappingReview({
  proposal,
  totalRowCount,
  onChangeMapping,
  onConfirm,
  onCancel,
}: {
  proposal: Proposal;
  totalRowCount: number;
  onChangeMapping: (index: number, targetField: string | null) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (proposal.entity_type === "unknown") {
    return (
      <div className="card p-6">
        <p className="font-medium">We couldn&apos;t confidently identify this file</p>
        <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
          {proposal.reasoning || "The columns don't clearly match customers, IP addresses, or equipment."}{" "}
          Try a different file, or check that the first row contains column headers.
        </p>
        <button className="btn-secondary mt-4" onClick={onCancel}>
          Try another file
        </button>
      </div>
    );
  }

  const options = TARGET_SCHEMAS[proposal.entity_type];

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            Detected as
          </p>
          <p className="font-medium capitalize">{proposal.entity_type.replace("_", " ")}</p>
        </div>
        <span className="mono text-xs" style={{ color: "var(--text-dim)" }}>
          {totalRowCount} rows · {Math.round(proposal.confidence * 100)}% confidence
        </span>
      </div>

      <p className="mt-3 text-sm" style={{ color: "var(--text-dim)" }}>
        {proposal.reasoning}
      </p>

      <div className="mt-6 space-y-2">
        {proposal.field_mappings.map((m, i) => (
          <div
            key={m.source_column}
            className="flex items-center gap-3 py-2 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <span className="mono text-sm flex-1 truncate">{m.source_column}</span>
            <span style={{ color: "var(--text-dim)" }}>→</span>
            <select
              className="input-field flex-1 text-sm"
              value={m.target_field ?? ""}
              onChange={(e) => onChangeMapping(i, e.target.value || null)}
            >
              <option value="">Don&apos;t import this column</option>
              {options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <button className="btn-primary" onClick={onConfirm}>
          Import {totalRowCount} rows
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function HealthReportView({
  report,
  onImportAnother,
  onGoToDashboard,
}: {
  report: HealthReport;
  onImportAnother: () => void;
  onGoToDashboard: () => void;
}) {
  const severityColor = { high: "var(--danger)", medium: "var(--warn)", low: "var(--text-dim)" };

  return (
    <div className="card p-6">
      <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--signal)" }}>
        AI Health Report
      </p>
      <p className="mt-3 leading-relaxed">{report.summary}</p>

      {report.findings.length > 0 && (
        <ul className="mt-6 space-y-3">
          {report.findings.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span
                className="h-1.5 w-1.5 rounded-full mt-2 shrink-0"
                style={{ background: severityColor[f.severity] }}
              />
              <span className="text-sm">{f.description}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex gap-3">
        <button className="btn-primary" onClick={onGoToDashboard}>
          Go to dashboard
        </button>
        <button className="btn-secondary" onClick={onImportAnother}>
          Import another file
        </button>
      </div>
    </div>
  );
}
