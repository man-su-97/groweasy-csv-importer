# GrowEasy AI CSV Importer

Upload a leads CSV from wherever — Facebook Ads, Google Ads, a CRM export, a spreadsheet
someone built by hand — and it gets mapped onto GrowEasy's CRM schema automatically. Column
names don't need to match anything, an LLM figures out the mapping.

Flow: upload → preview the raw rows → confirm → backend batches the rows to OpenAI → results
page shows what got imported vs skipped.

## Structure

```
apps/
├── web/    # Next.js frontend
└── api/    # Express backend — CSV parsing, AI mapping, validation
```

Two separate apps, deployed independently, talking over HTTP.

## Running locally

**Backend**

```bash
cd apps/api
npm install
cp .env.example .env   # add your OPENAI_API_KEY
npm run dev
```

Runs on `http://localhost:4000`. Health check at `/health`.

**Frontend**

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

Runs on `http://localhost:3000`. Upload a CSV, hit confirm, wait for it to map.

## Docker

```bash
OPENAI_API_KEY=sk-... docker compose up -d --build
```

Brings up both containers (api on 4000, web on 3000).

Or run them separately:

```bash
docker build -t groweasy-api ./apps/api
docker run -p 4000:4000 -e OPENAI_API_KEY=sk-... groweasy-api

docker build -t groweasy-web --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000 ./apps/web
docker run -p 3000:3000 groweasy-web
```

`NEXT_PUBLIC_API_URL` has to be a build arg, not a runtime `-e` — Next bakes it into the
client bundle at build time, so setting it after the image is built does nothing.

For the prod env file:

```bash
cp .env.prod.example .env.prod   # fill in OPENAI_API_KEY
docker compose --env-file .env.prod up -d --build
```

## Env vars

**apps/api**

| Var | Default |
|---|---|
| `OPENAI_API_KEY` | required |
| `OPENAI_MODEL` | `gpt-4o-mini` |
| `AI_BATCH_SIZE` | 25 rows per OpenAI call |
| `AI_BATCH_CONCURRENCY` | 4 batches in flight at once |
| `CORS_ORIGIN` | your deployed frontend's URL |
| `PORT` | 4000 |

**apps/web**

| Var | Default |
|---|---|
| `NEXT_PUBLIC_API_URL` | backend URL |

Real env files are gitignored, only `.env.example` / `.env.prod.example` are committed.

## Deploying

Frontend on Vercel, backend on Render — both have free tiers that work fine for this.
Point `NEXT_PUBLIC_API_URL` at the Render URL, and `CORS_ORIGIN` on the backend at the
Vercel URL. No trailing slash on either — a browser's `Origin` header never has one, so a
mismatched trailing slash makes CORS fail silently.

## CRM fields

`created_at`, `name`, `email`, `country_code`, `mobile_without_country_code`, `company`,
`city`, `state`, `country`, `lead_owner`, `crm_status`, `crm_note`, `data_source`,
`possession_time`, `description` — defined in `apps/api/src/types/crm.ts`.

- `crm_status` is one of `GOOD_LEAD_FOLLOW_UP`, `DID_NOT_CONNECT`, `BAD_LEAD`, `SALE_DONE`.
- `data_source` is one of `leads_on_demand`, `meridian_tower`, `eden_park`, `varah_swamy`,
  `sarjapur_plots`, or blank if the model isn't confident.
- A row only gets skipped if it has neither an email nor a mobile number. Anything else the
  AI can't map to a field goes into `crm_note` instead of getting dropped.

All of this is re-checked server-side in `validate.ts` regardless of what the model
returns — enums, date format, the skip rule, everything.
