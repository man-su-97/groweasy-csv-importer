import Papa from "papaparse";
import { CrmRecord, RawCsvRow } from "./types";

export interface ParsedCsv {
  rows: RawCsvRow[];
  columns: string[];
}

// client-side only, just for the preview table — no AI call happens here
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
