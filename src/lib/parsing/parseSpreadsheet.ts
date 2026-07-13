import * as XLSX from "xlsx";
import Papa from "papaparse";

/**
 * SECURITY NOTE: the `xlsx` (SheetJS) npm package has two known advisories
 * (prototype pollution, ReDoS) with no fix published to the npm registry —
 * SheetJS moved patched releases to their own CDN after npm registry
 * policy changes. Since this function parses files uploaded by end users,
 * treat this as a real, tracked risk, not a false positive from `npm
 * audit`. Before scaling past the design-partner stage, install the
 * patched build from https://cdn.sheetjs.com/ (see their docs for the
 * current tarball URL) in place of the npm-registry version, and keep
 * an eye on https://github.com/SheetJS/sheetjs for a registry fix.
 */

export interface ParsedSpreadsheet {
  headers: string[];
  rows: Record<string, unknown>[];
  sampleRows: Record<string, unknown>[];
  totalRowCount: number;
}

const SAMPLE_SIZE = 15;
const MAX_ROWS = 20000; // guardrail against pathological uploads

/**
 * Parses an uploaded .xlsx, .xls, or .csv file into headers + rows.
 * Returns a small sample (first N rows) alongside the full row count —
 * the AI mapping step only ever sees the sample, to keep token usage
 * bounded regardless of file size.
 */
export function parseSpreadsheet(
  fileBuffer: ArrayBuffer,
  filename: string
): ParsedSpreadsheet {
  const isCsv = filename.toLowerCase().endsWith(".csv");

  let headers: string[] = [];
  let rows: Record<string, unknown>[] = [];

  if (isCsv) {
    const text = new TextDecoder("utf-8").decode(fileBuffer);
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });
    headers = result.meta.fields ?? [];
    rows = result.data;
  } else {
    const workbook = XLSX.read(fileBuffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error("The uploaded file has no sheets.");
    }
    const sheet = workbook.Sheets[firstSheetName];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });
    headers = json.length > 0 ? Object.keys(json[0]) : [];
    rows = json;
  }

  if (rows.length === 0) {
    throw new Error(
      "No rows were found in this file. Check that the first row contains column headers."
    );
  }

  if (rows.length > MAX_ROWS) {
    throw new Error(
      `This file has ${rows.length} rows, which is above the ${MAX_ROWS}-row limit for Phase 1. Split it into smaller files and upload each separately.`
    );
  }

  return {
    headers,
    rows,
    sampleRows: rows.slice(0, SAMPLE_SIZE),
    totalRowCount: rows.length,
  };
}
