import OpenAI from "openai";
import { CRM_STATUS_VALUES, DATA_SOURCE_VALUES, CrmRecord, RawCsvRow } from "../types/crm";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const BATCH_SIZE = Number(process.env.AI_BATCH_SIZE || 25);
const MAX_RETRIES = 2;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

const SYSTEM_PROMPT = `You map arbitrary CRM/lead export CSV rows onto a fixed schema.
Input rows may come from Facebook Lead Ads, Google Ads, real-estate CRMs, sales reports,
or manually built spreadsheets — column names and layouts vary and are NOT known in advance.
Map whatever fields are present onto the target schema below using your best judgement
about what each source column means (e.g. "Phone", "Contact No.", "whatsapp_number" all
mean mobile_without_country_code).

Rules (follow exactly — do not deviate):
1. crm_status must be one of: ${CRM_STATUS_VALUES.join(", ")}, or null if none clearly applies.
2. data_source must be one of: ${DATA_SOURCE_VALUES.join(", ")}, or null if you are not
   confident — never guess-fill this field.
3. created_at must be a date string parseable by JavaScript's \`new Date(value)\`
   (ISO 8601 preferred, e.g. "2026-05-13 14:20:48" or "2026-05-13T14:20:48Z").
4. crm_note is the overflow field: put remarks, follow-up notes, extra context, and any
   additional emails/phone numbers beyond the first one found for a row.
5. If a row has multiple emails, keep only the first in "email" and append the rest into
   crm_note. Same rule for multiple mobile numbers and "mobile_without_country_code".
6. Never invent data that isn't present or reasonably inferable from the row.
7. Return every input row as one output record, in the same order — even rows you are
   unsure about. Downstream validation (not you) decides whether to skip a record; your
   job is best-effort mapping, not filtering.
8. country_code must come from an explicit signal in the row — a "+NN" prefix already on
   the phone number, or a country/location field you can confidently resolve to a dialing
   code. Never guess it from the mobile number's digit count or pattern alone (e.g. a
   10-digit number is not evidence of any specific country) — if there is no explicit
   signal, leave country_code null rather than guessing.

Example 1 — Facebook-style lead form export (input row -> output record):
Input: {"Date": "2026-05-13 14:20:48", "Full Name": "John Doe", "Email": "john.doe@example.com",
"Phone": "+91 9876543210", "Company": "GrowEasy", "City": "Mumbai", "State": "Maharashtra",
"Country": "India", "Owner": "test@gmail.com", "Status": "Follow up requested",
"Remarks": "Client is asking to reschedule demo"}
Output: {"created_at": "2026-05-13 14:20:48", "name": "John Doe", "email": "john.doe@example.com",
"country_code": "+91", "mobile_without_country_code": "9876543210", "company": "GrowEasy",
"city": "Mumbai", "state": "Maharashtra", "country": "India", "lead_owner": "test@gmail.com",
"crm_status": "GOOD_LEAD_FOLLOW_UP", "crm_note": "Client is asking to reschedule demo",
"data_source": null, "possession_time": null, "description": null}

Example 2 — real-estate CRM export, different header vocabulary, multiple emails/mobiles,
and a project name that happens to match an allowed data_source value:
Input: {"Enquiry Date": "13/05/2026", "Client Name": "Meera Nair",
"Email ID": "meera.nair@gmail.com, meera.n@work.com", "Mobile No": "9123456780 / 9988776655",
"Project": "Meridian Tower", "Location": "Bangalore", "Country": "India",
"Interested In": "3BHK", "Possession": "Dec 2026", "Assigned To": "sales2@groweasy.ai",
"Remark": "Wants site visit next weekend"}
Output: {"created_at": "2026-05-13", "name": "Meera Nair", "email": "meera.nair@gmail.com",
"country_code": "+91", "mobile_without_country_code": "9123456780", "company": null,
"city": "Bangalore", "state": null, "country": "India", "lead_owner": "sales2@groweasy.ai",
"crm_status": null, "crm_note": "Extra email: meera.n@work.com; Extra mobile: 9988776655; Wants site visit next weekend",
"data_source": "meridian_tower", "possession_time": "Dec 2026", "description": "Interested In: 3BHK"}
(Notes: "13/05/2026" is unambiguous DD/MM/YYYY since 13 cannot be a month — normalize it to
ISO "2026-05-13" rather than passing the raw string through. country_code "+91" is derived
from the explicit "Country": "India" field per rule 8, not guessed from the phone number.)

Example 3 — terse marketing/ad-campaign export with no CRM-shaped columns at all, no country
signal, and a field that superficially resembles a data_source but isn't a confident match:
Input: {"Campaign": "Google_Search_Jul2026", "Lead Phone": "8899001122",
"Ad Group": "3BHK-Sarjapur", "Form Name": "Get Callback"}
Output: {"created_at": null, "name": null, "email": null, "country_code": null,
"mobile_without_country_code": "8899001122", "company": null, "city": null, "state": null,
"country": null, "lead_owner": null, "crm_status": null,
"crm_note": "Campaign: Google_Search_Jul2026; Ad Group: 3BHK-Sarjapur; Form Name: Get Callback",
"data_source": null, "possession_time": null, "description": null}
(Notes: "Ad Group" mentions "Sarjapur", but an ad-targeting label is not a confident signal that
this lead came from the sarjapur_plots project — data_source stays null per rule 2, and the raw
campaign fields are preserved in crm_note per rule 4 instead of being discarded. country_code
stays null per rule 8 — nothing in this row states a country, so it is not guessed from the
phone number's digit pattern.)`;

const responseSchema = {
  type: "json_schema" as const,
  json_schema: {
    name: "crm_batch",
    strict: true,
    schema: {
      type: "object",
      properties: {
        records: {
          type: "array",
          items: {
            type: "object",
            properties: {
              created_at: { type: ["string", "null"] },
              name: { type: ["string", "null"] },
              email: { type: ["string", "null"] },
              country_code: { type: ["string", "null"] },
              mobile_without_country_code: { type: ["string", "null"] },
              company: { type: ["string", "null"] },
              city: { type: ["string", "null"] },
              state: { type: ["string", "null"] },
              country: { type: ["string", "null"] },
              lead_owner: { type: ["string", "null"] },
              crm_status: { type: ["string", "null"], enum: [...CRM_STATUS_VALUES, null] },
              crm_note: { type: ["string", "null"] },
              data_source: { type: ["string", "null"], enum: [...DATA_SOURCE_VALUES, null] },
              possession_time: { type: ["string", "null"] },
              description: { type: ["string", "null"] },
            },
            required: [
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
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["records"],
      additionalProperties: false,
    },
  },
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function mapBatch(rows: RawCsvRow[]): Promise<Partial<CrmRecord>[]> {
  const openai = getClient();
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(rows) },
        ],
        response_format: responseSchema,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from model");

      const parsed = JSON.parse(content) as { records: Partial<CrmRecord>[] };
      return parsed.records ?? [];
    } catch (err) {
      lastError = err;
      // Retry the failed batch only — not the whole file (bonus: retry mechanism).
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI batch mapping failed");
}

/**
 * Maps all rows to CRM records, in bounded batches. If one batch exhausts
 * its retries, that batch's rows are dropped (counted as skipped by the
 * caller via the row-count mismatch) rather than failing the whole import —
 * one bad batch shouldn't sink an otherwise-successful large CSV.
 */
export async function mapRowsToCrm(rows: RawCsvRow[]): Promise<Partial<CrmRecord>[]> {
  const batches = chunk(rows, BATCH_SIZE);
  const results: Partial<CrmRecord>[] = [];

  for (const batch of batches) {
    try {
      const mapped = await mapBatch(batch);
      results.push(...mapped);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`AI batch of ${batch.length} rows failed after retries:`, err);
    }
  }

  return results;
}

