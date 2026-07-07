"use client";

import { useCallback, useRef, useState } from "react";
import { Download, UploadCloud } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CsvDropzoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

const CRM_HEADERS = [
  "created_at",
  "name",
  "email",
  "country_code",
  "mobile_without_country_code",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_status",
  "crm_note",
  "data_source",
  "possession_time",
  "description",
];

const SAMPLE_CSV_ROW = [
  "2026-05-13 14:20:48",
  "John Doe",
  "john.doe@example.com",
  "+91",
  "9876543210",
  "GrowEasy",
  "Mumbai",
  "Maharashtra",
  "India",
  "test@gmail.com",
  "GOOD_LEAD_FOLLOW_UP",
  "Client is asking to reschedule demo",
  "",
  "",
  "",
];

const SAMPLE_CSV_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(
  `${CRM_HEADERS.join(",")}\n${SAMPLE_CSV_ROW.map((v) => `"${v}"`).join(",")}\n`,
)}`;

export function CsvDropzone({ onFileSelected, disabled }: CsvDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
        alert("Please upload a .csv file.");
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Leads via CSV</CardTitle>
        <CardDescription>Upload a CSV file to bulk import leads — any column layout works.</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (!disabled) handleFiles(e.dataTransfer.files);
          }}
          onClick={() => !disabled && inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-lg border p-10 text-center transition-colors sm:p-12",
            isDragOver
              ? "border-primary/50 bg-primary/5"
              : "border-border bg-muted/30 hover:border-primary/30 hover:bg-primary/5",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={disabled}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-primary shadow-sm">
            <UploadCloud className="h-5 w-5" strokeWidth={2} />
          </div>
          <p className="text-sm font-semibold text-foreground">
            Drop your CSV file here, or <span className="text-primary">click to browse files</span>
          </p>
          <Badge variant="secondary" className="mt-2">
            Supported file: .csv (any layout)
          </Badge>
          <p className="mt-3 max-w-sm text-xs text-muted-foreground">
            Facebook/Google Ads exports, real-estate CRM exports, sales reports, or manual
            spreadsheets — column names don&apos;t need to match GrowEasy&apos;s CRM fields.
          </p>
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          Not sure what to upload?
          <a
            href={SAMPLE_CSV_HREF}
            download="groweasy_sample_leads.csv"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          >
            <Download className="h-3 w-3" /> Download a sample CSV template
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
