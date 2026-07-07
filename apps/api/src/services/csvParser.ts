import { parse } from "csv-parse/sync";
import { RawCsvRow } from "../types/crm";

const PARSE_OPTIONS = {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  relax_column_count: true,
} as const;

// Candidates to try, in order, only when comma parsing collapses to a
// single column. csv-parse's multi-delimiter auto-detect (`delimiter: [...]`)
// isn't quote-aware — it miscounts a delimiter char that appears inside a
// quoted value (e.g. "arjun@gmail.com; arjun.rao@work.com", a multi-email
// cell) and shifts every column. Trying comma first and only falling back
// on genuine failure avoids that.
const FALLBACK_DELIMITERS = [";", "\t", "|"];

/**
 * Parses raw CSV text into row objects keyed by header. Re-parses
 * server-side even though the frontend already parsed it for preview —
 * never trust the client's parse as the source of truth for what the AI
 * sees (a tampered/mismatched request body shouldn't silently pass through).
 */
export function parseCsv(csvText: string): RawCsvRow[] {
  const commaResult = parse(csvText, { ...PARSE_OPTIONS, delimiter: "," }) as RawCsvRow[];
  if (commaResult.length === 0 || Object.keys(commaResult[0]).length > 1) {
    return commaResult;
  }

  // Comma produced one giant column per row — likely the wrong delimiter
  // (e.g. an Excel "Save As CSV" export from a semicolon-locale). Try
  // alternates and use the first that yields more than one column.
  for (const delimiter of FALLBACK_DELIMITERS) {
    const result = parse(csvText, { ...PARSE_OPTIONS, delimiter }) as RawCsvRow[];
    if (result.length > 0 && Object.keys(result[0]).length > 1) {
      return result;
    }
  }

  return commaResult;
}
