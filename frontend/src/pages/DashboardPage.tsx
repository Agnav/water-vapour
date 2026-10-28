import { useState } from 'react'
import ForecastChart from '../features/forecasts/components/ForecastChart'
import ForecastTable from '../features/forecasts/components/ForecastTable'
import { useForecasts } from '../features/forecasts/hooks/useForecasts'
import type { ForecastQuery } from '../features/forecasts/types/forecast'
import { formatMw, strategies } from '../features/forecasts/utils/forecastUtils'

const MIN_DATE = '2026-01-01T00:00'
const MAX_DATE = '2026-01-31T23:00'
const DEFAULT_FROM = '2026-01-01T00:00'
const DEFAULT_TO = '2026-01-02T00:00'
const asUtc = (dateTime: string) => `${dateTime}:00Z`

export default function DashboardPage() {
  const [dates, setDates] = useState({ from: DEFAULT_FROM, to: DEFAULT_TO })
  const [strategy, setStrategy] = useState<ForecastQuery['publication_strategy']>('latest')
  const query: ForecastQuery = { from: asUtc(dates.from), to: asUtc(dates.to), publication_strategy: strategy }
  const { data, error, loading, retry } = useForecasts('dashboard', query)
  const updateDate = (name: 'from' | 'to', value: string) => setDates((current) => ({ ...current, [name]: value, ...(name === 'from' && value > current.to ? { to: value } : {}), ...(name === 'to' && value < current.from ? { from: value } : {}) }))
  return <div className="page-content"><header className="page-header"><div><div className="eyebrow">WIND GENERATION / OVERVIEW</div><h1>Dashboard</h1><p>Forecast performance against actual national wind generation.</p></div></header><section className="filter-bar" aria-label="Dashboard filters"><label>From<input type="datetime-local" step="3600" value={dates.from} min={MIN_DATE} max={MAX_DATE} onChange={(event) => updateDate('from', event.target.value)} /></label><span className="date-separator">to</span><label>To<input type="datetime-local" step="3600" value={dates.to} min={MIN_DATE} max={MAX_DATE} onChange={(event) => updateDate('to', event.target.value)} /></label><label className="strategy-field">Publication strategy<select value={strategy} onChange={(event) => setStrategy(event.target.value as ForecastQuery['publication_strategy'])}>{strategies.map(({ value }) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label></section>{loading && <div className="message">Loading dashboard data…</div>}{error && <div className="message error-message">{error}<button onClick={retry}>Retry</button></div>}{data && <><section className="metrics-grid"><Metric label="Mean absolute error" value={formatMw(data.metrics.mae_mw)} accent="purple" /><Metric label="Average forecast" value={formatMw(data.metrics.average_forecast_generation_mw)} accent="blue" /><Metric label="Average actual" value={formatMw(data.metrics.average_actual_generation_mw)} accent="green" /><Metric label="Matched observations" value={String(data.metrics.matched_observation_count)} accent="orange" /></section><section className="panel chart-panel"><div className="section-heading"><div><h2>Wind generation profile</h2><p>Forecast vs actual · {dates.from} – {dates.to}</p></div><span className="period-tag">MW</span></div><ForecastChart points={data.data.map((point) => ({ target_time: point.start_time, forecast_mw: point.forecast_generation_mw, actual_mw: point.actual_generation_mw, low_forecast_mw: null, medium_forecast_mw: null, high_forecast_mw: null }))} fixedScale mae={data.metrics.mae_mw} /></section><section className="panel table-panel"><div className="section-heading"><div><h2>Time series comparison</h2><p>{data.data.length} hourly observations</p></div></div><ForecastTable points={data.data.map((point) => ({ target_time: point.start_time, forecast_mw: point.forecast_generation_mw, actual_mw: point.actual_generation_mw, low_forecast_mw: null, medium_forecast_mw: null, high_forecast_mw: null, absolute_error_mw: point.absolute_error_mw }))} showAbsoluteError /></section></>}</div>
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) { return <article className="metric-card"><div className={`metric-accent ${accent}`} /><span>{label}</span><strong>{value}</strong><small>Selected date range</small></article> }
