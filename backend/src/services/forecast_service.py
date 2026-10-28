"""Forecast analytics calculations for selected series and forecast vintages."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from math import sqrt
from statistics import median

try:
    from .dashboard_service import DashboardData, PublicationStrategy, select_forecast
except ImportError:
    from services.dashboard_service import DashboardData, PublicationStrategy, select_forecast


QUARTERS = (
    ("00:00-05:59", 0, 6),
    ("06:00-11:59", 6, 12),
    ("12:00-17:59", 12, 18),
    ("18:00-23:59", 18, 24),
)


@dataclass(frozen=True)
class ForecastMetrics:
    mae_mw: float | None
    rmse_mw: float | None
    bias_mw: float | None
    average_forecast_mw: float | None
    average_actual_mw: float | None
    matched_count: int


@dataclass(frozen=True)
class ForecastTimeSeriesPoint:
    target_time: datetime
    forecast_mw: float | None
    actual_mw: float | None
    low_forecast_mw: float | None
    medium_forecast_mw: float | None
    high_forecast_mw: float | None


@dataclass(frozen=True)
class ForecastVintage:
    target_time: datetime
    publish_time: datetime
    forecast_mw: float


@dataclass(frozen=True)
class QuarterlyPerformance:
    quarter: str
    metrics: ForecastMetrics


@dataclass(frozen=True)
class ForecastAnalysis:
    summary: ForecastMetrics
    time_series: list[ForecastTimeSeriesPoint]
    quarterly_performance: list[QuarterlyPerformance]
    forecast_vintages: list[ForecastVintage]


def _calculate_metrics(matches: list[tuple[float, float]]) -> ForecastMetrics:
    if not matches:
        return ForecastMetrics(None, None, None, None, None, 0)
    count = len(matches)
    errors = [forecast - actual for forecast, actual in matches]
    return ForecastMetrics(
        mae_mw=sum(abs(error) for error in errors) / count,
        rmse_mw=sqrt(sum(error**2 for error in errors) / count),
        bias_mw=sum(errors) / count,
        average_forecast_mw=sum(forecast for forecast, _ in matches) / count,
        average_actual_mw=sum(actual for _, actual in matches) / count,
        matched_count=count,
    )


def build_forecast_analysis(
    data: DashboardData,
    from_time: datetime,
    to_time: datetime,
    strategy: PublicationStrategy,
) -> ForecastAnalysis:
    """Build selected-series metrics, all-vintage ranges, and UTC quarter performance."""
    all_by_target: dict[datetime, list] = {}
    for forecast in data.forecasts:
        if from_time <= forecast.start_time < to_time:
            all_by_target.setdefault(forecast.start_time, []).append(forecast)

    all_matches: list[tuple[float, float]] = []
    matches_by_quarter: dict[str, list[tuple[float, float]]] = {name: [] for name, _, _ in QUARTERS}
    time_series: list[ForecastTimeSeriesPoint] = []
    forecast_vintages: list[ForecastVintage] = []
    target_time = from_time
    while target_time < to_time:
        all_forecasts = all_by_target.get(target_time, [])
        actual = data.actuals.get(target_time)
        selected = select_forecast(
            [forecast for forecast in all_forecasts if forecast.publish_time <= target_time], strategy
        )
        values = [forecast.generation for forecast in all_forecasts]
        forecast_mw = selected.generation if selected else None
        actual_mw = actual.generation if actual else None
        if forecast_mw is not None and actual_mw is not None:
            match = (forecast_mw, actual_mw)
            all_matches.append(match)
            quarter_name = next(name for name, start_hour, end_hour in QUARTERS if start_hour <= target_time.hour < end_hour)
            matches_by_quarter[quarter_name].append(match)
        if all_forecasts or actual:
            time_series.append(ForecastTimeSeriesPoint(
                target_time=target_time,
                forecast_mw=forecast_mw,
                actual_mw=actual_mw,
                low_forecast_mw=min(values) if values else None,
                medium_forecast_mw=median(values) if values else None,
                high_forecast_mw=max(values) if values else None,
            ))
            forecast_vintages.extend(ForecastVintage(
                target_time=target_time,
                publish_time=forecast.publish_time,
                forecast_mw=forecast.generation,
            ) for forecast in sorted(all_forecasts, key=lambda item: item.publish_time))
        target_time += timedelta(hours=1)

    return ForecastAnalysis(
        summary=_calculate_metrics(all_matches),
        time_series=time_series,
        quarterly_performance=[
            QuarterlyPerformance(quarter=name, metrics=_calculate_metrics(matches_by_quarter[name]))
            for name, _, _ in QUARTERS
        ],
        forecast_vintages=forecast_vintages,
    )
