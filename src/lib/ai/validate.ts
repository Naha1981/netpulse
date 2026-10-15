/**
 * Data validation is deliberately NOT delegated to the LLM. Duplicate
 * detection and format checks need to be exact and reproducible — this
 * is plain, testable TypeScript. The AI's job (mapping.ts) is judgment
 * about ambiguous column names; this file's job is arithmetic.
 */

export interface ValidationFinding {
  type:
    | "duplicate_ip"
    | "invalid_ip_format"
    | "missing_required_field"
    | "duplicate_serial"
    | "expired_warranty";
  count: number;
  description: string;
  severity: "high" | "medium" | "low";
  sampleValues?: string[];
}

const IPV4_REGEX =
  /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

export function validateIpAddresses(
  rows: { ip_address?: unknown }[]
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const seen = new Map<string, number>();
  const invalid: string[] = [];

  for (const row of rows) {
    const raw = String(row.ip_address ?? "").trim();
    if (!raw) { invalid.push("(blank)"); continue; }

    if (!IPV4_REGEX.test(raw)) {
      invalid.push(raw);
      continue;
    }

    seen.set(raw, (seen.get(raw) ?? 0) + 1);
  }

  const duplicates = [...seen.entries()].filter(([, count]) => count > 1);
  if (duplicates.length > 0) {
    findings.push({
      type: "duplicate_ip",
      count: duplicates.length,
      description: `${duplicates.length} IP address${duplicates.length === 1 ? "" : "es"} appear more than once in this import — each one is assigned to multiple customers or devices.`,
      severity: "high",
      sampleValues: duplicates.slice(0, 5).map(([ip]) => ip),
    });
  }

  if (invalid.length > 0) {
    findings.push({
      type: "invalid_ip_format",
      count: invalid.length,
      description: `${invalid.length} value${invalid.length === 1 ? "" : "s"} in the IP address column ${invalid.length === 1 ? "doesn't" : "don't"} look like valid IPv4 addresses.`,
      severity: "medium",
      sampleValues: invalid.slice(0, 5),
    });
  }

  return findings;
}

export function validateRequiredField(
  rows: Record<string, unknown>[],
  field: string,
  entityLabel: string
): ValidationFinding[] {
  const missing = rows.filter((r) => !String(r[field] ?? "").trim());
  if (missing.length === 0) return [];

  return [
    {
      type: "missing_required_field",
      count: missing.length,
      description: `${missing.length} ${entityLabel} record${missing.length === 1 ? "" : "s"} ${missing.length === 1 ? "is" : "are"} missing a value for "${field}".`,
      severity: "medium",
    },
  ];
}

export function validateDuplicateSerials(
  rows: { serial_number?: unknown }[]
): ValidationFinding[] {
  const seen = new Map<string, number>();
  for (const row of rows) {
    const raw = String(row.serial_number ?? "").trim();
    if (!raw) continue;
    seen.set(raw, (seen.get(raw) ?? 0) + 1);
  }
  const duplicates = [...seen.entries()].filter(([, count]) => count > 1);
  if (duplicates.length === 0) return [];

  return [
    {
      type: "duplicate_serial",
      count: duplicates.length,
      description: `${duplicates.length} device serial number${duplicates.length === 1 ? "" : "s"} appear more than once — check for duplicate equipment entries.`,
      severity: "medium",
      sampleValues: duplicates.slice(0, 5).map(([s]) => s),
    },
  ];
}

export function validateExpiredWarranties(
  rows: { warranty_expiry?: unknown }[]
): ValidationFinding[] {
  const today = new Date();
  const expired = rows.filter((r) => {
    const raw = r.warranty_expiry;
    if (!raw) return false;
    const date = new Date(String(raw));
    return !Number.isNaN(date.getTime()) && date < today;
  });

  if (expired.length === 0) return [];

  return [
    {
      type: "expired_warranty",
      count: expired.length,
      description: `${expired.length} piece${expired.length === 1 ? "" : "s"} of equipment ${expired.length === 1 ? "has" : "have"} an expired warranty.`,
      severity: "low",
    },
  ];
}
