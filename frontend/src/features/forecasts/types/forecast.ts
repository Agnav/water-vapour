export type PublicationStrategy = 'earliest' | 'latest' | 'highest' | 'lowest'
export interface ForecastQuery { from: string; to: string; publication_strategy: PublicationStrategy }
export interface DashboardPoint { start_time: string; publish_time: string | null; forecast_generation_mw: number | null; actual_generation_mw: number | null; absolute_error_mw: number | null }
export interface DashboardResponse { metadata: { period_start: string; period_end: string; forecast_selection: string; matched_observation_count: number }; metrics: { mae_mw: number | null; average_forecast_generation_mw: number | null; average_actual_generation_mw: number | null; matched_observation_count: number }; data: DashboardPoint[] }
export interface ForecastMetrics { mae_mw: number | null; rmse_mw: number | null; bias_mw: number | null; average_forecast_mw: number | null; average_actual_mw: number | null; matched_count: number }
export interface ForecastTimeSeriesPoint { target_time: string; forecast_mw: number | null; actual_mw: number | null; low_forecast_mw: number | null; medium_forecast_mw: number | null; high_forecast_mw: number | null; absolute_error_mw?: number | null }
export interface QuarterlyPerformance extends ForecastMetrics { quarter: string }
export interface ForecastVintage { target_time: string; publish_time: string; forecast_mw: number }
export interface ForecastsResponse { metadata: { period_start: string; period_end: string; forecast_selection: string; matched_count: number }; summary: ForecastMetrics; time_series: ForecastTimeSeriesPoint[]; quarterly_performance: QuarterlyPerformance[]; forecast_vintages: ForecastVintage[] }
