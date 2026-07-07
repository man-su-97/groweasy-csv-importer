import Papa from "papaparse";
import { CrmRecord, RawCsvRow } from "./types";

export interface ParsedCsv {
  rows: RawCsvRow[];
  columns: string[];
}

/**
 * Client-side preview parse only (Step 2 of the flow). No AI call happens
 * here — this is purely for rendering the PreviewTable before the user
 * confirms the import.
 */
export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const columns = results.meta.fields ?? [];
        resolve({ rows: results.data, columns });
      },
      error: (err: Error) => reject(err),
    });
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Step 4 — serializes the AI-mapped, server-validated records back into a
 * CSV a user can re-import elsewhere as a "cleaned" version of their file.
 * Uses papaparse's own escaping (quotes, embedded commas) rather than
 * hand-rolled string joining.
 */
export function recordsToCsv(records: CrmRecord[], fieldOrder: (keyof CrmRecord)[]): string {
  const data = records.map((record) => fieldOrder.map((field) => record[field] ?? ""));
  return Papa.unparse({ fields: fieldOrder as string[], data });
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
