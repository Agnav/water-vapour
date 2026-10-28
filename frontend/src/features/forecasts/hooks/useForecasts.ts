import { useCallback, useEffect, useState } from 'react'
import { forecastService } from '../services/forecastService'
import type { DashboardResponse, ForecastQuery, ForecastsResponse } from '../types/forecast'

type ApiName = 'dashboard' | 'forecasts'
type ResponseFor<T extends ApiName> = T extends 'dashboard' ? DashboardResponse : ForecastsResponse

export function useForecasts<T extends ApiName>(api: T, query: ForecastQuery) {
  const [data, setData] = useState<ResponseFor<T> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const key = `${query.from}|${query.to}|${query.publication_strategy}`
  const load = useCallback(() => {
    let active = true
    setLoading(true); setError(null)
    forecastService[api](query).then((result) => { if (active) setData(result as ResponseFor<T>) }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load forecast data.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [api, key])
  useEffect(() => load(), [load])
  return { data, error, loading, retry: load }
}
