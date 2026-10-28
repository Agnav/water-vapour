# Wind forecast dashboard deployment

This repository contains a React/Vite frontend and a FastAPI backend.

## Run both apps in one Docker container

From this directory:

```bash
docker build -t wind-forecast-dashboard .
docker run --rm -p 8000:8000 wind-forecast-dashboard
```

Open `http://localhost:8000`. The frontend and API use the same origin; the API
is available at `/api/v1/dashboard`, `/api/v1/forecasts`, and `/health`.

## Deploy to Vercel

Vercel deploys this as one project, not as the Docker container: it builds the
React site and FastAPI as two Vercel Services, exposed through the same domain.
`vercel.json` contains the required service and rewrite rules.

1. Import this repository into Vercel and select the repository root as the
   project root.
2. Keep the detected framework/settings; `vercel.json` configures both services.
3. Deploy. No environment variable is required for the default same-origin API.

For a separately hosted API, set `VITE_API_BASE_URL` in Vercel to its public
origin (for example, `https://api.example.com`) and redeploy.
