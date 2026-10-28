# Windforecast Dashboard

A full-stack dashboard for exploring UK national wind-generation forecasts against actual generation. The application compares bundled Elexon forecast publications with actual wind output, presents forecast accuracy metrics, and lets users choose how a forecast publication is selected for each target hour.

The repository can run as one Docker container: the FastAPI service serves both the API and the compiled React single-page application (SPA).

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Run with Docker](#run-with-docker-recommended)
- [Run locally without Docker](#run-locally-without-docker)
- [Configuration](#configuration)
- [API](#api)
- [Data and forecast selection](#data-and-forecast-selection)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Features

- Dashboard showing forecast versus actual wind generation, MAE, averages, and hourly comparisons.
- Forecast-analysis view with MAE, RMSE, bias, time-of-day performance, forecast ranges, and publication history.
- Four per-hour publication-selection strategies: `earliest`, `latest`, `highest`, and `lowest`.
- FastAPI OpenAPI documentation at `/docs`.
- A same-origin production deployment, so no CORS configuration or separate API URL is needed when using Docker.

## Architecture

```text
Browser
  │
  │  HTTP: / and /api/v1/*
  ▼
FastAPI application (port 8000)
  ├── serves the compiled React/Vite SPA from /static
  ├── /health
  └── /api/v1
       ├── /dashboard
       └── /forecasts
              │
              ▼
        Service layer
              │
              ▼
  Startup-loaded JSON snapshots
  ├── WINDFOR.json — forecast publications
  └── FUELHH.json  — actual generation readings
```

### Request flow

1. The React frontend requests dashboard or forecast data with `fetch`.
2. In the Docker image, the request stays on the same origin and reaches FastAPI. During local frontend development it targets `http://127.0.0.1:8000` by default.
3. FastAPI validates the requested UTC whole-hour range and publication strategy.
4. The service selects a forecast for every requested target hour, joins it to an exact-time actual reading, and calculates metrics.
5. The API returns JSON for the frontend chart, tables, and metric cards.

The JSON data is loaded once at application startup and kept in application state. The application does not call external APIs at runtime.

## Repository layout

```text
.
├── Dockerfile.vercel          # Multi-stage image: Vite build + FastAPI runtime
├── requirements.txt           # Python runtime dependencies
├── vercel.json                # Vercel services and same-origin rewrites
├── backend/
│   ├── src/main.py            # FastAPI app, lifespan, routers, SPA serving
│   ├── src/routes/            # HTTP endpoint definitions
│   ├── src/services/          # Data loading and forecast calculations
│   ├── src/utils/             # Timestamp validation helpers
│   └── src/data/              # Bundled Elexon data snapshots
└── frontend/
    ├── src/pages/             # Dashboard and forecast page composition
    ├── src/features/forecasts/ # Forecast UI, types, hook, service, utilities
    ├── src/services/api.ts    # Shared HTTP client
    └── package.json           # Vite commands and frontend dependencies
```

Additional implementation-level references are available in [backend/Architecture.md](backend/Architecture.md) and [frontend/architecture.md](frontend/architecture.md).

## Prerequisites

For the recommended path, install [Docker](https://docs.docker.com/get-docker/) and ensure the Docker daemon is running.

For local development without Docker, install:

- Node.js 22 or newer and npm
- Python 3.12 or newer

## Run with Docker (recommended)

Run all commands below from the repository root.

### 1. Build the image

The Dockerfile is named `Dockerfile.vercel`, so pass it explicitly:

```bash
docker build --file Dockerfile.vercel --tag windforecast-dashboard .
```

The first stage installs frontend dependencies and creates a production Vite build. The final Python image installs FastAPI, copies the backend and built frontend, then starts Uvicorn.

### 2. Start the container

```bash
docker run --rm --publish 8000:8000 --name windforecast-dashboard windforecast-dashboard
```

Open the following URLs:

- Application: <http://localhost:8000>
- API documentation: <http://localhost:8000/docs>
- Health check: <http://localhost:8000/health>

The `--rm` option removes the stopped container automatically. Stop the foreground process with `Ctrl+C`.

### Run in the background

```bash
docker run --detach --rm --publish 8000:8000 --name windforecast-dashboard windforecast-dashboard
docker logs --follow windforecast-dashboard
```

Stop it when finished:

```bash
docker stop windforecast-dashboard
```

### Use a different host port

If port 8000 is already in use, map another host port to the container's port 8000:

```bash
docker run --rm --publish 8080:8000 --name windforecast-dashboard windforecast-dashboard
```

Then open <http://localhost:8080>.

### Rebuild after a change

```bash
docker build --file Dockerfile.vercel --tag windforecast-dashboard .
docker run --rm --publish 8000:8000 windforecast-dashboard
```

If an old background container is still using the port, stop it before starting the new one.

## Run locally without Docker

Use two terminals from the repository root.

### Terminal 1: start the API

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --requirement requirements.txt
PYTHONPATH=backend uvicorn src.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

The API is now available at <http://127.0.0.1:8000>, with documentation at <http://127.0.0.1:8000/docs>.

### Terminal 2: start the frontend

```bash
cd frontend
npm ci
npm run dev
```

Vite prints the local URL (normally <http://localhost:5173>). The default development configuration calls the API at `http://127.0.0.1:8000`, which is permitted by the backend's CORS configuration.

### Create a production frontend build locally

```bash
cd frontend
npm ci
npm run build
```

The output is written to `frontend/dist`. The Docker build copies this equivalent production build into the final image automatically.

## Configuration

The only frontend runtime/build setting is optional:

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Public base URL for a separately hosted API. | Same origin in a production build; `http://127.0.0.1:8000` in Vite development. |

For example, create `frontend/.env` when the API is hosted elsewhere:

```env
VITE_API_BASE_URL=https://api.example.com
```

Restart Vite or rebuild the frontend after changing a `VITE_` variable. Do not put secrets in this file: Vite embeds `VITE_` variables into browser-delivered code.

The container accepts a `PORT` environment variable and defaults to `8000`:

```bash
docker run --rm --publish 8080:8080 --env PORT=8080 windforecast-dashboard
```

## API

All API timestamps must be ISO-8601 UTC values on a whole-hour boundary. `from` is inclusive and `to` is exclusive.

| Endpoint | Description |
| --- | --- |
| `GET /health` | Returns `{"status":"ok"}`. |
| `GET /api/v1/dashboard` | Forecast-versus-actual comparison and dashboard metrics. |
| `GET /api/v1/forecasts` | Accuracy summary, time series, time-of-day performance, and publication history. |
| `GET /docs` | Interactive OpenAPI documentation. |

Both forecast endpoints require `from`, `to`, and `publication_strategy` query parameters. Example:

```bash
curl --get 'http://localhost:8000/api/v1/dashboard' \
  --data-urlencode 'from=2026-01-01T00:00:00Z' \
  --data-urlencode 'to=2026-01-02T00:00:00Z' \
  --data-urlencode 'publication_strategy=latest'
```

Valid strategies are `earliest`, `latest`, `highest`, and `lowest`. Invalid timestamps, non-UTC values, incomplete hours, unsupported strategies, or a range where `from >= to` return HTTP 422.

## Data and forecast selection

`backend/src/data/WINDFOR.json` contains forecast publications and `backend/src/data/FUELHH.json` contains 30-minute generation readings. Only `WIND` actual-generation rows are used. A forecast is matched only to an actual with the exact same target timestamp; adjacent half-hour readings are not averaged.

For each requested target hour, only publications made at or before that target are eligible. The chosen forecast depends on the strategy:

| Strategy | Selection rule |
| --- | --- |
| `earliest` | First eligible publication. |
| `latest` | Most recent eligible publication. |
| `highest` | Highest generation value; latest publication breaks ties. |
| `lowest` | Lowest generation value; latest publication breaks ties. |

Metrics only include matched forecast/actual pairs. When no match is available, the relevant metric is `null` and the matched count is zero.

## Deployment

`vercel.json` defines two Vercel services: the React web app and the FastAPI API. It rewrites `/api/*` and `/health` to the API while serving all remaining paths from the web service.

To deploy with Vercel, import this repository and use the repository root as the project root. No environment variable is needed for the default same-origin setup. Set `VITE_API_BASE_URL` only if the API lives on a different public origin.

## Troubleshooting

| Problem | Resolution |
| --- | --- |
| `Cannot connect to the Docker daemon` | Start Docker Desktop or the Docker service, then rerun the command. |
| `bind: address already in use` | Stop the process using port 8000, or map a different host port such as `--publish 8080:8000`. |
| Docker build cannot find the Dockerfile | Include `--file Dockerfile.vercel` when building from the repository root. |
| Frontend cannot reach the API in local development | Confirm Uvicorn is running on port 8000 and use the Vite URL, normally port 5173. |
| API returns HTTP 422 | Check that both dates include `Z`, are UTC whole hours, `from` precedes `to`, and the strategy is valid. |
| A Docker change does not appear | Rebuild the image, then start a new container from the rebuilt tag. |

## Useful commands

```bash
# Frontend linting
cd frontend && npm run lint

# Frontend production build
cd frontend && npm run build

# Check the running service
curl http://localhost:8000/health
```
