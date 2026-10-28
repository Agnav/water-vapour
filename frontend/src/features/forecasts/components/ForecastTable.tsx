import { useState } from 'react'
import type { ForecastTimeSeriesPoint } from '../types/forecast'
import { formatMw, formatTime } from '../utils/forecastUtils'

export default function ForecastTable({ points, showAbsoluteError = false, publicationOnly = false, timeSeries = false }: { points: (ForecastTimeSeriesPoint & { absolute_error_mw?: number | null })[]; showAbsoluteError?: boolean; publicationOnly?: boolean; timeSeries?: boolean }) {
  const [page, setPage] = useState(0)
  const pageSize = 10
  const pageCount = Math.ceil(points.length / pageSize)
  const visiblePoints = points.slice(page * pageSize, (page + 1) * pageSize)
  return <><div className="table-scroll"><table className="data-table"><thead><tr><th>{publicationOnly ? 'Publication time' : 'Target time'}</th><th>Forecast</th>{!publicationOnly && <th>Actual</th>}{timeSeries && <><th>Low forecast</th><th>Median forecast</th><th>High forecast</th></>}{showAbsoluteError && <th>Absolute error</th>}</tr></thead><tbody>{visiblePoints.length ? visiblePoints.map((point) => <tr key={point.target_time}><td>{formatTime(point.target_time)}</td><td>{formatMw(point.forecast_mw)}</td>{!publicationOnly && <td>{formatMw(point.actual_mw)}</td>}{timeSeries && <><td>{formatMw(point.low_forecast_mw)}</td><td>{formatMw(point.medium_forecast_mw)}</td><td>{formatMw(point.high_forecast_mw)}</td></>}{showAbsoluteError && <td>{formatMw(point.absolute_error_mw ?? null)}</td>}</tr>) : <tr><td colSpan={(publicationOnly ? 2 : 3) + Number(showAbsoluteError) + (timeSeries ? 3 : 0)} className="table-empty">No observations in this date range.</td></tr>}</tbody></table></div>{pageCount > 1 && <div className="pagination"><span>Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, points.length)} of {points.length}</span><div><button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}>Previous</button><span>Page {page + 1} of {pageCount}</span><button type="button" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page >= pageCount - 1}>Next</button></div></div>}</>
}
