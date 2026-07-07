import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CrmRecord, CrmStatus, ImportResult } from "@/lib/types";
import { type VariantProps } from "class-variance-authority";

const COLUMNS: { key: keyof CrmRecord; label: string }[] = [
  { key: "created_at", label: "Created At" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "country_code", label: "Country Code" },
  { key: "mobile_without_country_code", label: "Mobile" },
  { key: "company", label: "Company" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "country", label: "Country" },
  { key: "lead_owner", label: "Lead Owner" },
  { key: "crm_status", label: "Status" },
  { key: "crm_note", label: "Note" },
  { key: "data_source", label: "Source" },
  { key: "possession_time", label: "Possession Time" },
  { key: "description", label: "Description" },
];

interface ResultsTableProps {
  result: ImportResult;
}

/**
 * Step 4 — shows AI-extracted CRM records plus the imported/skipped/total
 * counts the spec asks for.
 */
export function ResultsTable({ result }: ResultsTableProps) {
  const { imported, skipped, total } = result;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total rows" value={total} tone="neutral" />
        <StatCard label="Imported" value={imported.length} tone="success" />
        <StatCard label="Skipped" value={skipped} tone="warning" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="max-h-[480px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {COLUMNS.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {imported.map((record, i) => (
                <TableRow key={i}>
                  {COLUMNS.map((col) => (
                    <TableCell key={col.key} title={record[col.key] ?? ""}>
                      {col.key === "crm_status" && record.crm_status ? (
                        <StatusBadge status={record.crm_status} />
                      ) : (
                        record[col.key] ?? <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {imported.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No records were imported — every row was skipped.
          </div>
        ) : null}
      </div>
    </div>
  );
}

const STATUS_BADGE_VARIANT: Record<CrmStatus, VariantProps<typeof badgeVariants>["variant"]> = {
  SALE_DONE: "info",
  GOOD_LEAD_FOLLOW_UP: "success",
  DID_NOT_CONNECT: "secondary",
  BAD_LEAD: "destructive",
};

const STATUS_BADGE_LABELS: Record<CrmStatus, string> = {
  SALE_DONE: "Sale Done",
  GOOD_LEAD_FOLLOW_UP: "Good Lead",
  DID_NOT_CONNECT: "Not Dialed",
  BAD_LEAD: "Bad Lead",
};

function StatusBadge({ status }: { status: CrmStatus }) {
  return <Badge variant={STATUS_BADGE_VARIANT[status]}>{STATUS_BADGE_LABELS[status]}</Badge>;
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "warning";
}) {
  const toneClasses = {
    neutral: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-primary",
  }[tone];

  return (
    <Card className="p-4">
      <div className={cn("text-2xl font-semibold", toneClasses)}>{value.toLocaleString()}</div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    </Card>
  );
}
