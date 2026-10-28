"""Data loading and forecast accuracy calculations for the dashboard."""

import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path

from ..utils.timestamps import parse_source_utc


DATA_DIRECTORY = Path(__file__).parent.parent / "data"


class PublicationStrategy(str, Enum):
    earliest = "earliest"
    latest = "latest"
    highest = "highest"
    lowest = "lowest"

    @property
    def metadata_value(self) -> str:
        return f"{self.value}_available_publication"


@dataclass(frozen=True)
class ForecastRecord:
    start_time: datetime
    publish_time: datetime
    generation: float


@dataclass(frozen=True)
class ActualRecord:
    start_time: datetime
    generation: float


@dataclass(frozen=True)
class DashboardData:
    forecasts: list[ForecastRecord]
    actuals: dict[datetime, ActualRecord]


@dataclass(frozen=True)
class DashboardPoint:
    start_time: datetime
    publish_time: datetime | None
    forecast_generation_mw: float | None
    actual_generation_mw: float | None
    absolute_error_mw: float | None


@dataclass(frozen=True)
class DashboardResult:
    points: list[DashboardPoint]
    mae_mw: float | None
    average_forecast_generation_mw: float | None
    average_actual_generation_mw: float | None
    matched_observation_count: int


def load_dashboard_data() -> DashboardData:
    """Load and validate the local Elexon snapshots once at application startup."""
    try:
        with (DATA_DIRECTORY / "WINDFOR.json").open(encoding="utf-8") as file:
            raw_forecasts = json.load(file)
        with (DATA_DIRECTORY / "FUELHH.json").open(encoding="utf-8") as file:
            raw_actuals = json.load(file)
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError("Unable to load local wind-generation data") from error

    forecasts: list[ForecastRecord] = []
    for row in raw_forecasts:
        if not all(key in row for key in ("startTime", "publishTime", "generation")):
            raise RuntimeError("WINDFOR data contains a record missing a required field")
        forecasts.append(ForecastRecord(
            start_time=parse_source_utc(row["startTime"], "WINDFOR startTime"),
            publish_time=parse_source_utc(row["publishTime"], "WINDFOR publishTime"),
            generation=float(row["generation"]),
        ))

    actuals: dict[datetime, ActualRecord] = {}
    for row in raw_actuals:
        if row.get("fuelType") != "WIND":
            continue
        if not all(key in row for key in ("startTime", "generation")):
            raise RuntimeError("FUELHH data contains a WIND record missing a required field")
        start_time = parse_source_utc(row["startTime"], "FUELHH startTime")
        if start_time in actuals:
            raise RuntimeError(f"FUELHH data contains duplicate WIND startTime: {row['startTime']}")
        actuals[start_time] = ActualRecord(start_time=start_time, generation=float(row["generation"]))
    return DashboardData(forecasts=forecasts, actuals=actuals)


def select_forecast(candidates: list[ForecastRecord], strategy: PublicationStrategy) -> ForecastRecord | None:
    if not candidates:
        return None
    if strategy is PublicationStrategy.earliest:
        return min(candidates, key=lambda record: record.publish_time)
    if strategy is PublicationStrategy.latest:
        return max(candidates, key=lambda record: record.publish_time)
    if strategy is PublicationStrategy.highest:
        return max(candidates, key=lambda record: (record.generation, record.publish_time))
    return min(candidates, key=lambda record: (record.generation, -record.publish_time.timestamp()))


def build_dashboard(data: DashboardData, from_time: datetime, to_time: datetime, strategy: PublicationStrategy) -> DashboardResult:
    """Select forecasts, match actuals, and calculate matched-observation metrics."""
    candidates_by_target: dict[datetime, list[ForecastRecord]] = {}
    forecast_target_times: set[datetime] = set()
    for forecast in data.forecasts:
        if from_time <= forecast.start_time < to_time:
            forecast_target_times.add(forecast.start_time)
            if forecast.publish_time <= forecast.start_time:
                candidates_by_target.setdefault(forecast.start_time, []).append(forecast)

    points: list[DashboardPoint] = []
    matched_forecasts: list[float] = []
    matched_actuals: list[float] = []
    target_time = from_time
    while target_time < to_time:
        if target_time in forecast_target_times or target_time in data.actuals:
            forecast = select_forecast(candidates_by_target.get(target_time, []), strategy)
            actual = data.actuals.get(target_time)
            forecast_generation = forecast.generation if forecast else None
            actual_generation = actual.generation if actual else None
            absolute_error = abs(forecast_generation - actual_generation) if forecast_generation is not None and actual_generation is not None else None
            if absolute_error is not None:
                matched_forecasts.append(forecast_generation)
                matched_actuals.append(actual_generation)
            points.append(DashboardPoint(
                start_time=target_time,
                publish_time=forecast.publish_time if forecast else None,
                forecast_generation_mw=forecast_generation,
                actual_generation_mw=actual_generation,
                absolute_error_mw=absolute_error,
            ))
        target_time += timedelta(hours=1)

    count = len(matched_forecasts)
    return DashboardResult(
        points=points,
        mae_mw=sum(abs(forecast - actual) for forecast, actual in zip(matched_forecasts, matched_actuals)) / count if count else None,
        average_forecast_generation_mw=sum(matched_forecasts) / count if count else None,
        average_actual_generation_mw=sum(matched_actuals) / count if count else None,
        matched_observation_count=count,
    )
