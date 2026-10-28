import { apiGet } from '../../../services/api'
import type { DashboardResponse, ForecastQuery, ForecastsResponse } from '../types/forecast'

const params = (query: ForecastQuery) => ({ from: query.from, to: query.to, publication_strategy: query.publication_strategy })
export const forecastService = {
  dashboard: (query: ForecastQuery) => apiGet<DashboardResponse>('/api/v1/dashboard', params(query)),
  forecasts: (query: ForecastQuery) => apiGet<ForecastsResponse>('/api/v1/forecasts', params(query)),
}
