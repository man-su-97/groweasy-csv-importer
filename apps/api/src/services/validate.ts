import {
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
  CrmRecord,
  CrmStatus,
  DataSource,
} from "../types/crm";

const CRM_STATUS_SET = new Set<string>(CRM_STATUS_VALUES);
const DATA_SOURCE_SET = new Set<string>(DATA_SOURCE_VALUES);

function isValidCrmStatus(value: unknown): value is CrmStatus {
  return typeof value === "string" && CRM_STATUS_SET.has(value);
}

function isValidDataSource(value: unknown): value is DataSource {
  return typeof value === "string" && DATA_SOURCE_SET.has(value);
}

function isValidDate(value: unknown): boolean {
  if (typeof value !== "string" || value.trim() === "") return false;
  return !Number.isNaN(new Date(value).getTime());
}

/**
 * Escape embedded newlines so the record stays a single CSV row if it's
 * ever exported (Invariant 6). Applied to any free-text field.
 */
function escapeNewlines(value: string | null): string | null {
  if (value == null) return value;
  return value.replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Server-side re-validation of one AI-produced record against the CRM
 * contract (ARCHITECTURE.md "Invariants"). The model is the mapper, not the
 * source of truth for enums/date format — never pass raw model output
 * straight through.
 *
 * Returns null if the record fails the hard skip rule (Invariant 7:
 * neither email nor mobile present).
 */
export function sanitizeRecord(raw: Partial<CrmRecord>): CrmRecord | null {
  const email = typeof raw.email === "string" && raw.email.trim() !== "" ? raw.email.trim() : null;
  const mobile =
    typeof raw.mobile_without_country_code === "string" &&
    raw.mobile_without_country_code.trim() !== ""
      ? raw.mobile_without_country_code.trim()
      : null;

  // Invariant 7 — skip if neither email nor mobile is present.
  if (!email && !mobile) return null;

  const created_at = isValidDate(raw.created_at) ? (raw.created_at as string) : null;
  const crm_status = isValidCrmStatus(raw.crm_status) ? raw.crm_status : null;
  // Invariant 2 — blank (not a guess) if the model isn't confident.
  const data_source = isValidDataSource(raw.data_source) ? raw.data_source : null;

  return {
    created_at,
    name: raw.name ?? null,
    email,
    country_code: raw.country_code ?? null,
    mobile_without_country_code: mobile,
    company: raw.company ?? null,
    city: raw.city ?? null,
    state: raw.state ?? null,
    country: raw.country ?? null,
    lead_owner: raw.lead_owner ?? null,
    crm_status,
    crm_note: escapeNewlines(raw.crm_note ?? null),
    data_source,
    possession_time: raw.possession_time ?? null,
    description: escapeNewlines(raw.description ?? null),
  };
}

/**
 * Runs sanitizeRecord over a batch, splitting into imported vs skipped
 * counts. Never throws on a single bad record — one malformed row from the
 * AI must not fail the whole batch.
 */
export function sanitizeBatch(rawRecords: Partial<CrmRecord>[]): {
  imported: CrmRecord[];
  skipped: number;
} {
  const imported: CrmRecord[] = [];
  let skipped = 0;

  for (const raw of rawRecords) {
    const clean = sanitizeRecord(raw);
    if (clean) imported.push(clean);
    else skipped += 1;
  }

  return { imported, skipped };
}
