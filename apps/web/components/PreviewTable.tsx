import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { RawCsvRow } from "@/lib/types";

interface PreviewTableProps {
  columns: string[];
  rows: RawCsvRow[];
  maxRows?: number;
}

/**
 * Step 2 — raw preview only, no AI mapping applied yet. Sticky header +
 * horizontal/vertical scroll for wide or long CSVs.
 */
export function PreviewTable({ columns, rows, maxRows = 200 }: PreviewTableProps) {
  const visibleRows = rows.slice(0, maxRows);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="max-h-[420px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => (
                <TableHead key={col}>{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col} title={row[col]}>
                    {row[col]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="border-t border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Showing {visibleRows.length.toLocaleString()} of {rows.length.toLocaleString()} rows
      </div>
    </div>
  );
}
