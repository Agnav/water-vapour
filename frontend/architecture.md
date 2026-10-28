# Frontend Architecture

This document describes the frontend structure and tools currently in use. Keep future changes consistent with it and update it when the implementation changes.

```text
public/
└── favicon.svg
src/
├── features/
│   └── forecasts/
│       ├── components/
│       │   ├── ForecastChart.tsx
│       │   └── ForecastTable.tsx
│       ├── hooks/
│       │   └── useForecasts.ts
│       ├── services/
│       │   └── forecastService.ts
│       ├── types/
│       │   └── forecast.ts
│       └── utils/
│           └── forecastUtils.ts
├── pages/
│   ├── DashboardPage.tsx
│   └── ForecastsPage.tsx
├── services/
│   └── api.ts
├── App.tsx
├── App.css
├── index.css
└── main.tsx
```

## Current implementation

- React and TypeScript are built with Vite.
- `src/App.tsx` provides the dashboard and forecast page navigation and shared layout.
- Route-level page content lives in `src/pages/`.
- Forecast API types, calls, hook state, chart/table components, and formatting helpers live in `src/features/forecasts/`.
- `src/services/api.ts` is the shared HTTP client. It uses the browser's built-in `fetch` and `URL.searchParams` to encode raw query values once.
- The forecast hook uses React state and effects for loading, errors, data, and retry behavior.
- Styling uses the repository's CSS files. The graph is drawn with SVG.
- Environment configuration uses Vite's `import.meta.env`, including `VITE_API_BASE_URL`.

## Placement rules

- Keep forecast-specific UI, API logic, types, and helpers in `src/features/forecasts/`.
- Keep page composition in `src/pages/` and shared HTTP behavior in `src/services/api.ts`.
- Use existing React, TypeScript, browser `fetch`, SVG, and CSS patterns. TanStack Query, Axios, shadcn/ui, and a charting package are not currently part of this frontend.
- Add shared directories or dependencies only when the implementation needs them, and update this document at that time.
