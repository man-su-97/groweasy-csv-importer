import { parse } from "csv-parse/sync";
import { RawCsvRow } from "../types/crm";

const PARSE_OPTIONS = {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  relax_column_count: true,
} as const;

// only tried if comma parsing gives a single column — csv-parse's own
// multi-delimiter detection isn't quote-aware, so it can misfire on a
// value like "a@x.com; b@x.com" inside a comma-delimited file
const FALLBACK_DELIMITERS = [";", "\t", "|"];

// re-parses server-side even though the frontend already parsed it for
// preview, since we don't trust the client's parse as the source of truth
export function parseCsv(csvText: string): RawCsvRow[] {
  const commaResult = parse(csvText, { ...PARSE_OPTIONS, delimiter: "," }) as RawCsvRow[];
  if (commaResult.length === 0 || Object.keys(commaResult[0]).length > 1) {
    return commaResult;
  }

  // comma gave one giant column per row, so it's probably the wrong delimiter
  for (const delimiter of FALLBACK_DELIMITERS) {
    const result = parse(csvText, { ...PARSE_OPTIONS, delimiter }) as RawCsvRow[];
    if (result.length > 0 && Object.keys(result[0]).length > 1) {
      return result;
    }
  }

  return commaResult;
}
