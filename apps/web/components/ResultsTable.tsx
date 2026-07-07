import { Download } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { downloadTextFile, recordsToCsv } from "@/lib/csv";
import { CRM_FIELD_ORDER, CrmRecord, CrmStatus, ImportResult } from "@/lib/types";
import { type VariantProps } from "class-variance-authority";

const COLUMN_LABELS: Record<keyof CrmRecord, string> = {
  created_at: "Created At",
  name: "Name",
  email: "Email",
  country_code: "Country Code",
  mobile_without_country_code: "Mobile",
  company: "Company",
  city: "City",
  state: "State",
  country: "Country",
  lead_owner: "Lead Owner",
  crm_status: "Status",
  crm_note: "Note",
  data_source: "Source",
  possession_time: "Possession Time",
  description: "Description",
};

const COLUMNS = CRM_FIELD_ORDER.map((key) => ({ key, label: COLUMN_LABELS[key] }));

interface ResultsTableProps {
  result: ImportResult;
}

export function ResultsTable({ result }: ResultsTableProps) {
  const { imported, skipped, total } = result;

  function handleExport() {
    const csv = recordsToCsv(imported, CRM_FIELD_ORDER);
    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(`groweasy_imported_leads_${date}.csv`, csv, "text/csv;charset=utf-8;");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total rows" value={total} tone="neutral" />
        <StatCard label="Imported" value={imported.length} tone="success" />
        <StatCard label="Skipped" value={skipped} tone="warning" />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Imported records</p>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={imported.length === 0}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
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
