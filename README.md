# GrowEasy AI CSV Importer

Upload any lead-export CSV (Facebook Lead Ads, Google Ads, real-estate CRM exports, manual
spreadsheets — column names and layout unknown ahead of time) → preview it → confirm → an
LLM maps whatever columns exist onto the GrowEasy CRM schema → view imported vs skipped
records.

CRM schema (`apps/api/src/types/crm.ts`, mirrored in `apps/web/lib/types.ts`):

| Field | Notes |
|---|---|
| `created_at` | must be parseable by JS `new Date(created_at)` |
| `name` | |
| `email` | primary email only — extra emails go into `crm_note` |
| `country_code` | e.g. `+91` — only set from an explicit signal, never guessed from the phone number |
| `mobile_without_country_code` | primary mobile only — extra numbers go into `crm_note` |
| `company` / `city` / `state` / `country` | |
| `lead_owner` | |
| `crm_status` | enum: `GOOD_LEAD_FOLLOW_UP`, `DID_NOT_CONNECT`, `BAD_LEAD`, `SALE_DONE` |
| `crm_note` | overflow field — remarks, extra emails/mobiles, anything else useful |
| `data_source` | enum: `leads_on_demand`, `meridian_tower`, `eden_park`, `varah_swamy`, `sarjapur_plots`, or blank if not confident |
| `possession_time` / `description` | |

A record is dropped (and counted in `skipped`) only if it has **neither** an `email` **nor** a
`mobile_without_country_code`. All of the above is enforced server-side in
`apps/api/src/services/validate.ts` regardless of what the model returns.

## Project structure

```
apps/
├── web/    # Next.js frontend (upload, preview, results)
└── api/    # Express backend (CSV parsing, AI mapping, validation)
```

The two apps are deployed independently and talk over HTTP — no shared build step.

## Setup

### 1. Backend (`apps/api`)

```bash
cd apps/api
npm install
cp .env.example .env
# edit .env and set OPENAI_API_KEY
npm run dev
```

Runs on `http://localhost:4000` by default. Health check: `GET /health`.

### 2. Frontend (`apps/web`)

```bash
cd apps/web
npm install
cp .env.example .env.local
# NEXT_PUBLIC_API_URL should point at the backend above
npm run dev
```

Runs on `http://localhost:3000`.

Open `http://localhost:3000`, upload a CSV, preview it, click **Confirm & Import**, and
the AI-mapped results will appear once processing finishes.

## Running with Docker

```bash
OPENAI_API_KEY=sk-... docker compose up -d --build
```

Starts both containers: API on `http://localhost:4000`, web on
`http://localhost:3000`. Optional overrides: `OPENAI_MODEL`, `AI_BATCH_SIZE`
(see `docker-compose.yml`). Stop with `docker compose down`.

Each app also has its own standalone `Dockerfile` if you want to build/run
them independently instead of via compose:

```bash
docker build -t groweasy-api ./apps/api
docker run -p 4000:4000 -e OPENAI_API_KEY=sk-... groweasy-api

docker build -t groweasy-web --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000 ./apps/web
docker run -p 3000:3000 groweasy-web
```

Note `NEXT_PUBLIC_API_URL` must be passed at **build** time (`--build-arg`), not as a runtime
`-e` — Next.js inlines `NEXT_PUBLIC_*` values into the client bundle when it's built, so
setting it as a runtime env var on an already-built container does nothing.

### Running the prod config with Docker

```bash
cp .env.prod.example .env.prod        # fill in OPENAI_API_KEY
docker compose --env-file .env.prod up -d --build
```

## Environment variables

Every real env file (`.env`, `.env.local`, `.env.prod`, at any level) is
git-ignored — only the `*.example` templates are tracked. **Never put a
real key in a `.example` file** — those are exactly what ends up in the
public GitHub repo this assignment requires.

| File | Committed? | Purpose |
|---|---|---|
| `apps/api/.env.example` | yes | dev template — copy to `apps/api/.env` |
| `apps/api/.env.prod.example` | yes | prod template — copy to `apps/api/.env.prod` |
| `apps/web/.env.example` | yes | dev template — copy to `apps/web/.env.local` |
| `apps/web/.env.prod.example` | yes | prod template — copy to `apps/web/.env.prod` |
| `.env.prod.example` (root) | yes | template for `docker compose --env-file` prod runs |

Before deploying for real, replace the placeholder URLs in the `.env.prod`
files (`CORS_ORIGIN`, `NEXT_PUBLIC_API_URL`) with your actual Vercel /
Railway / Render URLs once they exist — they can't be known until after
the first deploy.

## Environment variables (detail)

**`apps/api/.env`**

| Var | Purpose |
|---|---|
| `PORT` | API port (default `4000`) |
| `CORS_ORIGIN` | Frontend origin allowed to call the API |
| `OPENAI_API_KEY` | required — no default |
| `OPENAI_MODEL` | defaults to `gpt-4o-mini` |
| `AI_BATCH_SIZE` | rows per AI batch call (default `25`) |

**`apps/web/.env.local`**

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the deployed/local backend |

## Deployment

- **Frontend:** Vercel — set `NEXT_PUBLIC_API_URL` to the deployed backend's URL.
- **Backend:** Railway or Render — set `OPENAI_API_KEY` and `CORS_ORIGIN` (the deployed
  frontend's URL) in the service's environment settings.

No database is used — the app is stateless; each import request is processed and returned
in a single request/response cycle.

## How the AI mapping works

`apps/api/src/services/aiMapper.ts` batches parsed CSV rows (default 25/batch) and sends
each batch to OpenAI with a system prompt describing the GrowEasy CRM schema and mapping
rules (enum allowlists, date format, note-overflow, multi-value dedup — see the schema
table above). Responses are constrained via OpenAI's structured-output JSON schema mode.
Every AI-returned record is then re-validated server-side in `validate.ts` — the model
maps, the validator enforces the contract.
