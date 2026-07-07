# GrowEasy AI CSV Importer

Take-home assignment for GrowEasy (Software Developer Intern / Full-Time).
Upload any CSV (Facebook Lead Export, Google Ads Export, real-estate CRM
exports, manual spreadsheets — column names/layout unknown ahead of time) →
preview client-side → on confirm, backend batches rows to an LLM → LLM maps
whatever columns exist onto the fixed GrowEasy CRM schema → frontend shows
imported vs skipped records.

**The challenge is not CSV parsing. It's field mapping under uncertainty.**
Any two input files may use completely different column names for the same
CRM field (`Phone` vs `Mobile` vs `Contact No.` vs `whatsapp_number`). All the
engineering effort belongs in the AI mapping step and its guardrails, not in
CSV parsing (a solved problem — use a library).

**Deadline: 12 July 2026.** Submission = hosted app URL + public GitHub repo
URL + position applied for, emailed to **varun@groweasy.ai**. See
"Submission checklist" at the bottom before you consider this done.

---

## Tech stack (locked)

| Layer | Choice |
|-------|--------|
| Frontend | Next.js (App Router), TypeScript |
| CSV parsing (client-side preview) | `papaparse` — parse in-browser for Step 2, no backend call yet |
| Backend | Node.js + Express, TypeScript |
| AI | OpenAI (e.g. `gpt-4o-mini` for cost-effective batch extraction; upgrade to `gpt-4o` if mapping accuracy on messy files is poor) |
| Database | **None — stateless.** Uploaded CSV lives only in the request lifecycle; nothing persisted server-side. Simplifies hosting for the deadline; revisit only if bonus points are worth the extra infra. |
| Deployment | Vercel (frontend) + Railway or Render (backend Express API) |

**Why stateless:** the spec explicitly lists DB as optional, and every day
spent on persistence is a day not spent on AI mapping accuracy or frontend
polish — both of which are graded; "did you add a database" is not.

---

## Repository layout

```
groweasy-csv-importer/
├── apps/
│   ├── web/                  # Next.js frontend
│   │   ├── app/
│   │   │   ├── page.tsx          # upload → preview → confirm → results, single page or wizard
│   │   │   └── api/               # only if proxying to hide backend URL; otherwise call apps/api directly
│   │   ├── components/
│   │   │   ├── CsvDropzone.tsx    # drag & drop + file picker (Step 1)
│   │   │   ├── PreviewTable.tsx   # raw parsed rows, virtualized if large (Step 2)
│   │   │   └── ResultsTable.tsx   # imported vs skipped (Step 4)
│   │   └── lib/
│   │       └── csv.ts             # papaparse wrapper
│   └── api/                  # Express backend
│       ├── src/
│       │   ├── index.ts
│       │   ├── routes/import.ts       # POST /api/import
│       │   ├── services/
│       │   │   ├── csvParser.ts       # csv → row objects (backend re-parse of confirmed rows)
│       │   │   ├── aiMapper.ts        # batches rows → OpenAI → CRM JSON, owns the prompt
│       │   │   └── validate.ts        # enum allowlists, date check, skip rule (see Invariants)
│       │   └── types/crm.ts           # CrmRecord type — single source of truth for the schema
│       └── package.json
├── README.md                 # setup instructions — required for submission
└── ARCHITECTURE.md           # this file
```

Two independent deployables (Vercel + Railway/Render) rather than folding
Express into Next.js API routes — matches the spec's explicit "Frontend
Requirements" / "Backend Requirements" split and keeps the AI mapping logic
portable if it ever needs to move (batch job, CLI, etc.).

---

## The flow (matches the spec's 4 frontend steps + 4 backend steps exactly)

1. **Upload** (`CsvDropzone`) — drag/drop or file picker. No parsing yet.
2. **Preview** (`PreviewTable`) — parse client-side with `papaparse`, render
   raw rows in a scrollable/sticky-header table. **No AI call here** — the
   spec calls this out explicitly ("No AI processing should happen yet").
3. **Confirm** — only on button click does the frontend POST to
   `apps/api`'s `/api/import`. Sends either the raw CSV text or the
   already-parsed rows (prefer raw CSV + re-parse server-side — never trust
   client-side parsing as the source of truth for what the AI sees).
4. **Backend**: parse → batch rows → call OpenAI per batch → validate each
   returned record against the rules in "Invariants" below → return
   `{ imported: CrmRecord[], skipped: number, total: number }`.
5. **Results** (`ResultsTable`) — imported vs skipped counts + the records
   themselves.

---

## CRM schema (the contract)

Every extracted record is shaped exactly like this — `apps/api/src/types/crm.ts`
is the single source of truth, and the AI prompt must reference these field
names verbatim:

| Field | Notes |
|---|---|
| `created_at` | must be parseable by JS `new Date(created_at)` |
| `name` | |
| `email` | primary email only — see rule 5 below for extras |
| `country_code` | e.g. `+91` |
| `mobile_without_country_code` | primary mobile only — see rule 5 |
| `company` | |
| `city` / `state` / `country` | |
| `lead_owner` | |
| `crm_status` | **enum, see Invariant 1** |
| `crm_note` | freeform dumping ground — see Invariant 4 |
| `data_source` | **enum or blank, see Invariant 2** |
| `possession_time` | |
| `description` | |

---

## Invariants

These are graded directly under "AI Prompt Engineering" and "Backend
Quality" in the spec's evaluation criteria — violating any of them is a bug
even if the demo looks fine on the sample CSV.

1. **`crm_status` must be one of exactly:** `GOOD_LEAD_FOLLOW_UP`,
   `DID_NOT_CONNECT`, `BAD_LEAD`, `SALE_DONE`. Never invent a new value —
   validate the AI's output against this allowlist server-side in
   `validate.ts` before returning it; if the model hallucinates something
   else, either remap to the closest allowed value or drop the field, never
   pass through raw model output uncontrolled.

2. **`data_source` must be one of exactly:** `leads_on_demand`,
   `meridian_tower`, `eden_park`, `varah_swamy`, `sarjapur_plots`, **or
   blank**. "Blank if not confident" is itself part of the contract — don't
   let the model guess-fill this from unrelated column names.

3. **`created_at` must survive `new Date(created_at)` in JS.** Test this
   literally in `validate.ts` (`!isNaN(new Date(value).getTime())`) — an
   AI-formatted date string that looks right to a human but fails silently
   in JS breaks every downstream CRM consumer.

4. **`crm_note` is the overflow field.** Route into it: remarks, follow-up
   notes, any extra emails/mobiles beyond the first (rule 5), and anything
   useful that doesn't map to a named field. Never discard information the
   source CSV had just because it doesn't fit a column — that's data loss,
   explicitly penalized under "Handling messy datasets."

5. **Multiple emails/mobiles in one source row:** keep only the *first* in
   `email`/`mobile_without_country_code`; append the rest into `crm_note`.
   Don't silently drop the extras, and don't put more than one value in the
   primary field (breaks CRM import on the other end).

6. **CSV output validity:** each record is one CSV row. If an AI-produced
   field contains a literal newline (common in notes/description text),
   escape it (e.g. `\n`) rather than letting it split the row — a raw
   newline here corrupts the whole export, not just one record.

7. **Skip rule:** if a record has **neither** `email` **nor**
   `mobile_without_country_code`, drop it from `imported` and count it in
   `skipped`. This is the only hard skip condition — don't invent
   additional silent-drop conditions (e.g. missing `name`) beyond this one,
   or the "total imported / total skipped" counts the frontend shows won't
   match user expectations from the source file.

8. **`country_code` must come from an explicit signal** — a `+NN` prefix
   already on the phone number, or a country/location field that resolves
   confidently to a dialing code. Never infer it from a mobile number's
   digit count or pattern alone; leave it blank rather than guess.

---

## Guardrails

- **LLM structured-output reliability.** Use OpenAI's JSON mode /
  `response_format: { type: "json_schema" }` (or function calling) rather
  than parsing free-text completions — free-text JSON parsing is where
  batch AI extraction quietly breaks on edge-case rows.
- **Batching size.** Send rows in bounded batches (e.g. 20–50 rows/call),
  not the whole CSV in one prompt — large CSVs will blow context limits or
  degrade mapping accuracy per-row. Batch size is also where the bonus
  "retry mechanism for failed AI batches" plugs in: retry the batch, not
  the whole file.
- **Ambiguous column names.** The prompt needs a few worked examples — don't
  rely on field names alone; show the model 2-3 input→output examples
  covering header naming conventions different from the CRM's own (e.g.
  `Phone`, `Full Name`, `Lead Source`, or a real-estate CRM's `Enquiry Date`
  / `Mobile No`).
- **Server-side re-validation is not optional.** The model is the mapper,
  not the source of truth for the enums/date format — `validate.ts` must
  enforce Invariants 1–3 and 8 regardless of what the model returns.
- **Delimiter detection.** Excel's "Save As CSV" defaults to semicolons
  outside US locales. Don't assume comma — but don't blindly auto-detect
  either, since a delimiter-detector that isn't quote-aware will miscount a
  delimiter character that appears *inside* a quoted value (e.g. multiple
  emails separated by `;` in one cell). Only fall back to an alternate
  delimiter when the default comma parse genuinely produces a single
  garbage column.

---

## Footguns actually hit

- **`apps/web/public/` must exist, even empty.** The web Dockerfile does
  `COPY --from=build /app/public ./public` unconditionally (standard
  Next.js standalone-output pattern) — a hand-scaffolded app without a
  `public/` folder fails the Docker build with "not found" on that COPY
  step. Fixed by adding `apps/web/public/.gitkeep`.
- **`NEXT_PUBLIC_API_URL` is a build arg, not a runtime env var.** Next.js
  inlines `NEXT_PUBLIC_*` values into the client bundle at `next build`
  time. The web `Dockerfile` takes it as `ARG NEXT_PUBLIC_API_URL` and
  `docker-compose.yml` passes it under `build.args`, not `environment:`.
  Setting it as a plain runtime env var on the `web` container does
  nothing — the browser bundle already has whatever URL was baked in at
  build time.
- **`docker compose --env-file` resolves relative to your shell's cwd, not
  the compose file's location.** Compose auto-discovers `docker-compose.yml`
  from a parent directory if you run the command from a subdirectory, but
  `--env-file .env.prod` still resolves against cwd — run from a
  subdirectory with its own (different) `.env.prod` and you silently load
  the wrong env file. Always run `docker compose` from the repo root.
- **A missing `OPENAI_API_KEY` fails silently from the user's perspective.**
  Every AI batch call throws, retries exhaust, and the batch's rows are
  dropped and counted as `skipped` rather than surfacing an error — a CSV
  import that returns "100 skipped, 0 imported" looks like a mapping
  problem but is actually a missing-env-var problem. Worth checking API
  container logs first whenever the skip rate looks abnormally high.

---

## Conventions

- **Adding a CRM field.** Update `apps/api/src/types/crm.ts` (the schema
  source of truth), the AI prompt's field list and few-shot examples in
  `aiMapper.ts`, and the `ResultsTable` column list on the frontend — three
  places kept in sync by convention, not by a shared package.
- **Error handling.** Every backend route returns a consistent error shape
  (`{ error: string }` + appropriate status code); frontend never renders
  raw exception text — this is graded under both "Backend Quality" and
  "Frontend Quality" (error handling appears in both lists).
- **Type safety.** Both apps in TypeScript, `CrmRecord` type mirrored
  (copied, not a shared package) between `aiMapper.ts`'s return type and the
  frontend's `ResultsTable` props — explicitly graded under "Code Quality."

---

## Evaluation criteria (from the spec — keep visible while building)

- **AI Prompt Engineering:** accurate extraction, intelligent mapping,
  messy datasets, ambiguous columns.
- **Backend Quality:** API design, clean architecture, error handling,
  batch processing, maintainability.
- **Frontend Quality:** modern UI, responsive layout, clean UX, preview
  experience, loading states, error handling.
- **Code Quality:** readability, type safety, folder structure, reusability,
  best practices.
- **Overall Engineering:** performance, edge-case handling, production
  readiness.

## Bonus points (prioritize by effort-to-signal ratio given the deadline)

Cheap and high-signal first: drag & drop (near-free with most upload
libraries), loading/progress indicators during AI processing, a
well-written README, Docker setup. Higher-effort: retry mechanism for
failed AI batches, virtualized table for large CSVs, streaming/incremental
parsing, dark mode, unit tests.

---

## Submission checklist

- [ ] Publicly hosted app (Vercel for web, Railway/Render for API)
- [ ] Public GitHub repository
- [ ] README with setup instructions
- [ ] Email to **varun@groweasy.ai** with: hosted URL, GitHub URL, and
      position applied for (Intern or Full-Time)
- [ ] Sent before **12 July 2026**
