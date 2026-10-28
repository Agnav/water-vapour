"""Dashboard HTTP contract and route."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

try:
    from ..services.dashboard_service import PublicationStrategy, build_dashboard
    from ..utils.timestamps import require_whole_hour_utc
except ImportError:
    from services.dashboard_service import PublicationStrategy, build_dashboard
    from utils.timestamps import require_whole_hour_utc


router = APIRouter(prefix="/api/v1", tags=["dashboard"])


class DashboardMetadata(BaseModel):
    period_start: datetime
    period_end: datetime
    timezone: str = "UTC"
    unit: str = "MW"
    forecast_selection: str
    matched_observation_count: int


class DashboardMetrics(BaseModel):
    mae_mw: float | None = Field(description="Mean absolute error for matched observations, in MW.")
    average_forecast_generation_mw: float | None
    average_actual_generation_mw: float | None
    matched_observation_count: int


class ComparisonPoint(BaseModel):
    start_time: datetime
    publish_time: datetime | None
    forecast_generation_mw: float | None
    actual_generation_mw: float | None
    absolute_error_mw: float | None


class DashboardResponse(BaseModel):
    metadata: DashboardMetadata
    metrics: DashboardMetrics
    data: list[ComparisonPoint]


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    request: Request,
    from_: Annotated[datetime, Query(alias="from")],
    to: datetime,
    publication_strategy: PublicationStrategy,
) -> DashboardResponse:
    from_utc = require_whole_hour_utc(from_, "from")
    to_utc = require_whole_hour_utc(to, "to")
    if from_utc >= to_utc:
        raise HTTPException(status_code=422, detail="from must be earlier than to")

    result = build_dashboard(
        data=request.app.state.dashboard_data,
        from_time=from_utc,
        to_time=to_utc,
        strategy=publication_strategy,
    )
    return DashboardResponse(
        metadata=DashboardMetadata(
            period_start=from_utc,
            period_end=to_utc,
            forecast_selection=publication_strategy.metadata_value,
            matched_observation_count=result.matched_observation_count,
        ),
        metrics=DashboardMetrics(
            mae_mw=result.mae_mw,
            average_forecast_generation_mw=result.average_forecast_generation_mw,
            average_actual_generation_mw=result.average_actual_generation_mw,
            matched_observation_count=result.matched_observation_count,
        ),
        data=[ComparisonPoint(**point.__dict__) for point in result.points],
    )
