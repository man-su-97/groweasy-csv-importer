import Papa from "papaparse";
import { RawCsvRow } from "./types";

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
