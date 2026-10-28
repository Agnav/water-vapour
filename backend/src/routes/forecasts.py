"""Forecast analytics HTTP contract and route."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from ..services.dashboard_service import PublicationStrategy
from ..services.forecast_service import build_forecast_analysis
from ..utils.timestamps import require_whole_hour_utc


router = APIRouter(prefix="/api/v1", tags=["forecasts"])


class ForecastMetadata(BaseModel):
    period_start: datetime
    period_end: datetime
    timezone: str = "UTC"
    unit: str = "MW"
    forecast_selection: str
    matched_count: int


class ForecastMetricsResponse(BaseModel):
    mae_mw: float | None
    rmse_mw: float | None
    bias_mw: float | None
    average_forecast_mw: float | None
    average_actual_mw: float | None
    matched_count: int


class ForecastTimeSeriesResponse(BaseModel):
    target_time: datetime
    forecast_mw: float | None
    actual_mw: float | None
    low_forecast_mw: float | None
    medium_forecast_mw: float | None
    high_forecast_mw: float | None


class QuarterlyPerformanceResponse(ForecastMetricsResponse):
    quarter: str


class ForecastVintageResponse(BaseModel):
    target_time: datetime
    publish_time: datetime
    forecast_mw: float


class ForecastsResponse(BaseModel):
    metadata: ForecastMetadata
    summary: ForecastMetricsResponse
    time_series: list[ForecastTimeSeriesResponse]
    quarterly_performance: list[QuarterlyPerformanceResponse]
    forecast_vintages: list[ForecastVintageResponse]


def _metrics_response(metrics) -> ForecastMetricsResponse:
    return ForecastMetricsResponse(**metrics.__dict__)


@router.get("/forecasts", response_model=ForecastsResponse)
async def get_forecasts(
    request: Request,
    from_: Annotated[datetime, Query(alias="from")],
    to: datetime,
    publication_strategy: PublicationStrategy,
) -> ForecastsResponse:
    from_utc = require_whole_hour_utc(from_, "from")
    to_utc = require_whole_hour_utc(to, "to")
    if from_utc >= to_utc:
        raise HTTPException(status_code=422, detail="from must be earlier than to")

    analysis = build_forecast_analysis(
        data=request.app.state.dashboard_data,
        from_time=from_utc,
        to_time=to_utc,
        strategy=publication_strategy,
    )
    return ForecastsResponse(
        metadata=ForecastMetadata(
            period_start=from_utc,
            period_end=to_utc,
            forecast_selection=publication_strategy.metadata_value,
            matched_count=analysis.summary.matched_count,
        ),
        summary=_metrics_response(analysis.summary),
        time_series=[ForecastTimeSeriesResponse(**point.__dict__) for point in analysis.time_series],
        quarterly_performance=[
            QuarterlyPerformanceResponse(quarter=performance.quarter, **performance.metrics.__dict__)
            for performance in analysis.quarterly_performance
        ],
        forecast_vintages=[ForecastVintageResponse(**vintage.__dict__) for vintage in analysis.forecast_vintages],
    )
