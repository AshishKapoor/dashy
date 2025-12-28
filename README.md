# Dashy

Dashy is a Django 5 + React 19 stack for organization-scoped BI with JWT auth, IoT time-series ingestion (TimescaleDB), and a Vite-powered UI that uses a generated OpenAPI client.

<img width="1912" height="1241" alt="Screenshot 2025-12-27 at 10 01 00 PM" src="https://github.com/user-attachments/assets/344dbb91-6a49-4bec-a361-141533357a19" />


## Project layout

- Backend: Django API in [api/app](api/app) with apps `accounts` and `bi`; settings load `.env.dev` by default in [api/app/settings/base.py](api/app/settings/base.py).
- Auth: SimpleJWT with custom claims; token routes are exposed in [api/app/urls.py](api/app/urls.py) at `/api/auth/token`, `/api/auth/token/refresh`, and `/api/auth/token/verify`.
- Data model: Organizations, Roles, Memberships, Workspaces, Dashboards, Indicators, and IoT measurements; IoT hypertable setup lives in [api/app/bi/migrations/0002_enable_timescaledb_and_hypertable.py](api/app/bi/migrations/0002_enable_timescaledb_and_hypertable.py).
- API docs: drf-spectacular schema at `/api/schema/` and Swagger UI at `/api/docs/` via [api/app/urls.py](api/app/urls.py).
- Frontend: Vite/React app in [ui/app](ui/app) (alias `@` -> `ui/app`), using TanStack Query and the generated client from [ui/schema/dashy.yaml](ui/schema/dashy.yaml).

## Prerequisites

- Docker and Docker Compose (recommended path).
- If running locally: Python 3.12+, [uv](https://docs.astral.sh/uv/) for dependency management, Node 20+ with pnpm.

## Quick start (Docker)

1. Copy env template: `cp api/.env.example api/.env.dev` (adjust secrets as needed).
2. Build images: `docker compose build`.
3. Run migrations: `docker compose run migrate`.
4. Start stack: `docker compose up`.

Services

- API: http://localhost:8000/
- UI: http://localhost:5173/

## Local development (without Docker)

### Backend

1. `cd api`
2. `cp .env.example .env.dev` and ensure `DATABASE_HOST=localhost` if using a local Postgres.
3. Install deps: `make install`
4. Migrate: `make migrate`
5. Run dev server: `make run` (uses `app.settings.dev`).

### Frontend

1. `cd ui`
2. Install deps: `pnpm install`
3. Set `VITE_DEV_MODE=true` (or define `VITE_DATA_SERVICE_BASE_URL`) in a `.env.local` file if needed.
4. Run dev server: `pnpm dev` (defaults to http://localhost:5173/).

## Authentication

- Obtain tokens via `POST /api/auth/token` with `username` and `password`.
- Refresh via `POST /api/auth/token/refresh`.
- Tokens are stored in `localStorage` keys `access_token` and `refresh_token`; the Axios mutator injects the bearer token and redirects to `/login` on 401.

## API docs and client generation

- Swagger UI: http://localhost:8000/api/docs/
- Raw schema: http://localhost:8000/api/schema/
- Regenerate the React OpenAPI hooks: from `ui`, run `pnpm generate:client` (uses [ui/schema/dashy.yaml](ui/schema/dashy.yaml)).

## IoT ingestion and querying

- List/filter measurements: `GET /api/bi/iot/?device_id=...&metric=...` (scoped to the requester organization).
- Bulk ingest: `POST /api/bi/iot/ingest/`
  - JSON object format:
    ```json
    {
      "device_id": "dev-1",
      "metric": "temperature",
      "rows": [
        {
          "recorded_at": "2025-01-01T00:00:00Z",
          "value": 23.1,
          "tags": { "room": "A" }
        }
      ]
    }
    ```
  - JSON array (OpenAQ-style) is also supported.
  - CSV upload accepts columns: `device_id, metric, recorded_at, value, tags` (tags as JSON string).
- Read-only SQL helper: `POST /api/bi/viz/query/` executes SELECT-only queries with an injected organization filter; schema helper lives at `GET /api/bi/viz/schema/`.

### Example cURL (update credentials as needed)

```bash
API_BASE=http://localhost:8000
USERNAME=admin
PASSWORD=admin123

# 1) Obtain JWT pair
curl -X POST "$API_BASE/api/auth/token/" \
  -H "Content-Type: application/json" \
  -d '{"username": "'$USERNAME'", "password": "'$PASSWORD'"}'

# 2) Refresh access token
REFRESH="<paste refresh token>"
curl -X POST "$API_BASE/api/auth/token/refresh/" \
  -H "Content-Type: application/json" \
  -d '{"refresh": "'$REFRESH'"}'

# 3) Ingest IoT measurements (JSON object format)
ACCESS="<paste access token>"
curl -X POST "$API_BASE/api/bi/iot/ingest/" \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "dev-1",
    "metric": "temperature",
    "rows": [
      {"recorded_at": "2025-01-01T00:00:00Z", "value": 23.1, "tags": {"room": "A"}},
      {"recorded_at": "2025-01-01T01:00:00Z", "value": 22.7, "tags": {"room": "A"}}
    ]
  }'

# 4) Ingest IoT measurements (CSV upload)
cat > sample.csv <<'CSV'
device_id,metric,recorded_at,value,tags
dev-1,temperature,2025-01-01T02:00:00Z,22.5,"{\"room\":\"A\"}"
dev-1,temperature,2025-01-01T03:00:00Z,22.3,"{\"room\":\"A\"}"
CSV

curl -X POST "$API_BASE/api/bi/iot/ingest/" \
  -H "Authorization: Bearer $ACCESS" \
  -F "file=@sample.csv"
```

## Running tests and linting

- Backend: from `api` run `make test`, `make lint`, `make format`.
- Frontend: from `ui` run `pnpm lint`; Playwright e2e via `pnpm test` (or `pnpm test:ui`).

## Useful Make targets (backend)

- `make install` syncs dependencies with uv.
- `make migrate` applies migrations.
- `make run` starts the dev server.
- `make shell` opens `shell_plus`.
- `make app name=foo` scaffolds a Django app.

## Notes

- Default settings load `.env.dev`; production should point `ENV_FILE` to `.env.prod` in [api/app/settings/base.py](api/app/settings/base.py).
- All API endpoints require authentication by default; ensure the user is linked to an organization to see BI/IoT data.
