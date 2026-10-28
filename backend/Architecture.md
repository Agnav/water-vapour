# Windforecast API Architecture

## Overview

This FastAPI service compares UK national wind-generation forecasts with actual wind generation. It reads bundled Elexon snapshots only; it does not call external APIs at runtime.

```text
Client → FastAPI routers
         ├─ /health
         ├─ /api/v1/dashboard
         └─ /api/v1/forecasts
                    ↓
               service layer
                    ↓
          startup-loaded local JSON data
          ├─ WINDFOR forecast publications
          └─ FUELHH actual wind generation
```

`src/main.py` is the application entry point: it creates FastAPI, loads data during its lifespan, and registers routers. HTTP handlers live in `src/routes`, dashboard business logic and local-data access live in `src/services`, and reusable timestamp validation lives in `src/utils`. Both JSON files are loaded once at startup and kept in application state.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `src/main.py` | Application creation, lifespan startup, and router registration only. |
| `src/routes/health.py` | Health-check HTTP route. |
| `src/routes/dashboard.py` | Dashboard HTTP contract and request handling. |
| `src/routes/forecasts.py` | Forecast analytics HTTP contract and request handling. |
| `src/services/dashboard_service.py` | Source-data loading, validation, shared publication strategy, and dashboard calculations. |
| `src/services/forecast_service.py` | Forecast summary, ranges, UTC-quarter aggregation, and vintage analytics. |
| `src/utils/timestamps.py` | Reusable UTC parsing and whole-hour request validation. |
| `src/data/` | Bundled Elexon source snapshots. |

## Source data

| File | Used fields | Meaning |
| --- | --- | --- |
| `src/data/WINDFOR.json` | `startTime`, `publishTime`, `generation` | Hourly wind forecast target, publication time, and MW forecast. |
| `src/data/FUELHH.json` | `fuelType`, `startTime`, `generation` | Actual 30-minute generation. Only `fuelType: WIND` rows are used. |

All timestamps are UTC. An actual is matched only when its `startTime` exactly equals the hourly forecast target. Adjacent FUELHH half-hours are not averaged.

## Endpoints

### `GET /health`

Returns:

```json
{"status":"ok"}
```

### `GET /api/v1/dashboard`

Returns forecast-versus-actual data for the requested target-time range.

| Query parameter | Required | Rules |
| --- | --- | --- |
| `from` | Yes | Whole-hour, timezone-aware ISO-8601 UTC lower bound, inclusive. |
| `to` | Yes | Whole-hour, timezone-aware ISO-8601 UTC upper bound, exclusive; must be later than `from`. |
| `publication_strategy` | Yes | `earliest`, `latest`, `highest`, or `lowest`. |

Invalid parameters, non-UTC or non-whole-hour timestamps, an unsupported strategy, or `from >= to` return HTTP 422.

## Forecast selection and metrics

For every whole-hour target within `from <= startTime < to`, only forecasts where `publishTime <= startTime` are eligible. The endpoint chooses independently for each target hour:

| Strategy | Rule |
| --- | --- |
| `earliest` | Earliest eligible `publishTime`. |
| `latest` | Latest eligible `publishTime`. |
| `highest` | Greatest `generation`; ties use latest `publishTime`. |
| `lowest` | Lowest `generation`; ties use latest `publishTime`. |

An unavailable forecast is never replaced by a different publication. The selected forecast is then matched to actual generation by exact `startTime`. MAE, average forecast MW, and average actual MW include matched pairs only. Missing values remain null, contribute a per-row matched count of zero, and do not affect summary metrics.

## Dashboard contract

```json
{
  "metadata": {
    "period_start": "2026-01-01T00:00:00Z",
    "period_end": "2026-01-02T00:00:00Z",
    "timezone": "UTC",
    "unit": "MW",
    "forecast_selection": "latest_available_publication",
    "matched_observation_count": 24
  },
  "metrics": {
    "mae_mw": 123.4,
    "average_forecast_generation_mw": 10500.0,
    "average_actual_generation_mw": 10420.0,
    "matched_observation_count": 24
  },
  "data": [
    {
      "start_time": "2026-01-01T00:00:00Z",
      "publish_time": "2025-12-31T18:30:00Z",
      "forecast_generation_mw": 10500.0,
      "actual_generation_mw": 10420.0,
      "absolute_error_mw": 80.0
    }
  ]
}
```

### `metadata`

| Field | Description |
| --- | --- |
| `period_start` | Requested `from` timestamp, in UTC. |
| `period_end` | Requested `to` timestamp, in UTC and exclusive. |
| `timezone` | Always `UTC`. |
| `unit` | Always `MW`. |
| `forecast_selection` | Applied policy: `earliest_available_publication`, `latest_available_publication`, `highest_available_publication`, or `lowest_available_publication`. |
| `matched_observation_count` | Number of forecast/actual timestamp pairs used in metrics. |

### `metrics`

| Field | Description |
| --- | --- |
| `mae_mw` | Mean absolute error across matched observations; `null` when none match. |
| `average_forecast_generation_mw` | Mean selected forecast generation across matched observations; `null` when none match. |
| `average_actual_generation_mw` | Mean actual generation across matched observations; `null` when none match. |
| `matched_observation_count` | Same matched-pair count exposed in `metadata`. |

### `data`

The single `data` array is ordered by `start_time` and is used for both the graph and detailed comparison; it replaces separate graph and hourly-comparison arrays.

| Field | Description |
| --- | --- |
| `start_time` | Hourly target timestamp in UTC. |
| `publish_time` | UTC timestamp of the forecast selected for that target; `null` when no eligible forecast exists. |
| `forecast_generation_mw` | Selected forecast generation in MW; `null` when unavailable. |
| `actual_generation_mw` | Exact-timestamp actual generation in MW; `null` when unavailable. |
| `absolute_error_mw` | `abs(forecast_generation_mw - actual_generation_mw)` in MW; `null` unless both values exist. |

A target hour is included when an hourly forecast target or exact-hour actual exists; this preserves missing-side data without exposing FUELHH `:30` rows. If the range has no source targets, `data` is empty. If there are no matched observations, the endpoint returns HTTP 200 with null metric values and `matched_observation_count: 0`.

### `GET /api/v1/forecasts`

Returns selected-forecast accuracy, descriptive forecast-vintage ranges, time-of-day performance, and publication history. It accepts the same required whole-hour UTC `from`, `to`, and `publication_strategy` parameters as `/api/v1/dashboard`.

```json
{
  "metadata": {
    "period_start": "2026-01-01T00:00:00Z",
    "period_end": "2026-01-02T00:00:00Z",
    "timezone": "UTC",
    "unit": "MW",
    "forecast_selection": "latest_available_publication",
    "matched_count": 24
  },
  "summary": {
    "mae_mw": 500.0,
    "rmse_mw": 650.0,
    "bias_mw": 25.0,
    "average_forecast_mw": 12000.0,
    "average_actual_mw": 11975.0,
    "matched_count": 24
  },
  "time_series": [{
    "target_time": "2026-01-01T12:00:00Z",
    "forecast_mw": 12500.0,
    "actual_mw": 12100.0,
    "low_forecast_mw": 11800.0,
    "medium_forecast_mw": 12300.0,
    "high_forecast_mw": 13100.0
  }],
  "quarterly_performance": [{
    "quarter": "12:00-17:59",
    "mae_mw": 500.0,
    "rmse_mw": 650.0,
    "bias_mw": 25.0,
    "average_forecast_mw": 12000.0,
    "average_actual_mw": 11975.0,
    "matched_count": 6
  }],
  "forecast_vintages": [{
    "target_time": "2026-01-01T12:00:00Z",
    "publish_time": "2026-01-01T06:00:00Z",
    "forecast_mw": 11800.0
  }]
}
```

- `summary` and `quarterly_performance` use matched actuals and the same publication-strategy-selected series. `bias_mw` is forecast minus actual, so positive bias is overforecasting. MAPE is not returned.
- `time_series` is chronological across all selected days. Its selected `forecast_mw` uses only forecasts published on or before the target time; `actual_mw` is the exact-time actual.
- `low_forecast_mw`, `medium_forecast_mw`, and `high_forecast_mw` are the minimum, median, and maximum across all publications for that target, including publications after the target time. For an even number of values, median is the mean of the two middle values.
- `forecast_vintages` contains all publications in target-time then publication-time order, including post-target publications.
- Quarterly rows aggregate all requested dates into UTC buckets: `00:00-05:59`, `06:00-11:59`, `12:00-17:59`, and `18:00-23:59`. A quarter with no matches returns null numeric metrics and `matched_count: 0`.

## Data integrity and verification

Startup fails if a source file cannot be loaded, a required field is missing, a source timestamp is not valid UTC, or FUELHH has duplicate WIND target timestamps. The OpenAPI documentation is available at `/docs`.

Key verification cases are strategy selection and tie-breaking, exact timestamp matching, multi-day ordering, unmatched observations, empty results, and HTTP 422 validation failures. For `/api/v1/forecasts`, tests must also distinguish primary-series no-hindsight selection from descriptive ranges and vintages, which intentionally include post-target publications.
