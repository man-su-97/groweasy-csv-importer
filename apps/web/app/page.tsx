"use client";

import { useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CsvDropzone } from "@/components/CsvDropzone";
import { PreviewTable } from "@/components/PreviewTable";
import { ResultsTable } from "@/components/ResultsTable";
import { parseCsvFile, readFileAsText } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { ImportResult, RawCsvRow } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Step = "upload" | "preview" | "results";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [csvText, setCsvText] = useState<string>("");
  const [rows, setRows] = useState<RawCsvRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelected(file: File) {
    setError(null);
    try {
      const [text, parsed] = await Promise.all([readFileAsText(file), parseCsvFile(file)]);
      setCsvText(text);
      setRows(parsed.rows);
      setColumns(parsed.columns);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read the CSV file.");
    }
  }

  async function handleConfirmImport() {
    setError(null);
    setIsImporting(true);
    try {
      const res = await fetch(`${API_URL}/api/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Import failed (${res.status})`);
      }

      const data = (await res.json()) as ImportResult;
      setResult(data);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed. Please try again.");
    } finally {
      setIsImporting(false);
    }
  }

  function handleReset() {
    setStep("upload");
    setCsvText("");
    setRows([]);
    setColumns([]);
    setResult(null);
    setError(null);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-ink text-brand-ink-foreground">
            <TrendingUp className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              GrowEasy <span className="font-normal text-muted-foreground">AI CSV Importer</span>
            </h1>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              Upload any lead export — the AI maps whatever columns it finds onto the GrowEasy
              CRM schema.
            </p>
          </div>
        </div>
        <StepIndicator step={step} />
      </header>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {step === "upload" ? <CsvDropzone onFileSelected={handleFileSelected} /> : null}

      {step === "preview" ? (
        <div className="flex flex-col gap-4">
          <PreviewTable columns={columns} rows={rows} />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleConfirmImport} disabled={isImporting}>
              {isImporting ? "Mapping with AI…" : "Confirm & Import"}
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={isImporting}>
              Cancel
            </Button>
            {isImporting ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Processing {rows.length.toLocaleString()} rows in batches…
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === "results" && result ? (
        <div className="flex flex-col gap-4">
          <ResultsTable result={result} />
          <Button variant="outline" className="w-fit" onClick={handleReset}>
            Import another file
          </Button>
        </div>
      ) : null}
    </main>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "preview", label: "Preview & Confirm" },
    { key: "results", label: "Results" },
  ];
  const activeIndex = steps.findIndex((s) => s.key === step);

  return (
    <ol className="flex shrink-0 items-center gap-3 text-xs font-medium">
      {steps.map((s, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        return (
          <li key={s.key} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isDone
                    ? "bg-brand-ink text-brand-ink-foreground"
                    : "bg-secondary text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <span
              className={cn(
                "transition-colors",
                isActive ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
