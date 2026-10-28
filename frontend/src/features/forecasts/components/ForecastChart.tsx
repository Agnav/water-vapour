import { useMemo, useState } from 'react'
import type { DashboardPoint, ForecastTimeSeriesPoint } from '../types/forecast'

type ChartPoint = Pick<ForecastTimeSeriesPoint, 'target_time' | 'forecast_mw' | 'actual_mw'> | Pick<DashboardPoint, 'start_time' | 'forecast_generation_mw' | 'actual_generation_mw'>
const formatHour = (value: string) => new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
const formatAxisTime = (value: string, spanHours: number) => {
  const date = new Date(value)
  if (spanHours <= 24) return formatHour(value)
  if (spanHours <= 72) return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}
const formatMw = (value: number | null) => value === null ? 'Unavailable' : `${Math.round(value).toLocaleString()} MW`

export default function ForecastChart({ points, fixedScale = false, mae = null }: { points: ChartPoint[]; fixedScale?: boolean; mae?: number | null }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const rows = useMemo(() => points.map((point) => ({
    time: 'target_time' in point ? point.target_time : point.start_time,
    forecast: 'target_time' in point ? point.forecast_mw : point.forecast_generation_mw,
    actual: 'target_time' in point ? point.actual_mw : point.actual_generation_mw,
  })).sort((a, b) => a.time.localeCompare(b.time)), [points])
  const max = fixedScale ? 26000 : Math.max(26000, Math.ceil(Math.max(...rows.flatMap((row) => [row.forecast ?? 0, row.actual ?? 0])) / 5000) * 5000)
  const left = 44; const right = 990; const top = 16; const bottom = 210
  const x = (index: number) => left + index / Math.max(rows.length - 1, 1) * (right - left)
  const y = (value: number) => bottom - value / max * (bottom - top)
  const line = (key: 'forecast' | 'actual') => rows.map((row, index) => row[key] === null ? null : `${x(index)},${y(row[key]!)}`).filter((point): point is string => point !== null).join(' ')
  const ticks = rows.length <= 8 ? rows.map((_, index) => index) : Array.from({ length: 7 }, (_, index) => Math.round(index * (rows.length - 1) / 6))
  const spanHours = rows.length > 1 ? (Date.parse(rows[rows.length - 1].time) - Date.parse(rows[0].time)) / 3_600_000 : 0
  const active = activeIndex === null ? null : rows[activeIndex]
  const band = (value: number | null) => value === null ? null : Math.max(0, mae ?? 0)
  if (!rows.length) return <div className="empty-state">No observations for this date range.</div>
  const area = (key: 'forecast' | 'actual') => {
    const points = rows.map((row, index) => row[key] === null ? null : `${x(index)},${y(row[key]!)}`).filter((point): point is string => point !== null)
    return points.length ? `${x(0)},${bottom} ${points.join(' ')} ${x(rows.length - 1)},${bottom}` : ''
  }
  return <div className="profile-chart" onMouseLeave={() => setActiveIndex(null)}><div className="profile-legend"><span><i className="forecast-key" />Forecast</span><span><i className="actual-key" />Actual hourly mean</span>{mae !== null && <span><i className="range-key" />Indicative range: ± daily MAE</span>}</div><div className="profile-plot"><svg viewBox="0 0 1020 244" preserveAspectRatio="none" role="img" aria-label="Hourly wind forecast and actual generation"><defs><linearGradient id="forecast-flow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity=".27"/><stop offset="100%" stopColor="#f97316" stopOpacity=".015"/></linearGradient><linearGradient id="actual-flow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eab308" stopOpacity=".3"/><stop offset="100%" stopColor="#eab308" stopOpacity=".025"/></linearGradient></defs>{[0,7000,13000,20000,26000].map((value)=><g key={value}><line x1={left} x2={right} y1={y(value)} y2={y(value)} className="profile-grid"/><text x={left-8} y={y(value)+4} className="profile-axis" textAnchor="end">{value===0?'0k':`${Math.round(value/1000)}k`}</text></g>)}{mae!==null&&<polygon className="profile-band" points={[...rows.map((r,i)=>`${x(i)},${y(Math.min(max,r.forecast===null?0:r.forecast+(band(r.forecast)??0)) )}`),...rows.map((_,i)=>`${x(rows.length-1-i)},${y(Math.max(0,(rows[rows.length-1-i].forecast??0)-(band(rows[rows.length-1-i].forecast)??0)))}`)].join(' ')}/> }<polygon points={area('forecast')} fill="url(#forecast-flow)"/><polygon points={area('actual')} fill="url(#actual-flow)"/><polyline points={line('forecast')} className="profile-forecast"/><polyline points={line('actual')} className="profile-actual"/>{rows.map((row,index)=><rect key={row.time} x={x(index)-(right-left)/rows.length/2} y={top} width={(right-left)/rows.length} height={bottom-top} fill="transparent" onMouseEnter={()=>setActiveIndex(index)}/>)}{activeIndex!==null&&<line x1={x(activeIndex)} x2={x(activeIndex)} y1={top} y2={bottom} className="profile-cursor"/>}{activeIndex!==null&&rows[activeIndex]&&(['forecast','actual'] as const).map((key)=><circle key={key} cx={x(activeIndex)} cy={y(rows[activeIndex][key]??0)} r="4" className={key==='forecast'?'profile-point-forecast':'profile-point-actual'}/>)}</svg>{active&&<div className="profile-tooltip" style={{left:`${Math.min(90,Math.max(12,(x(activeIndex??0)/1020)*100))}%`}}><span>{formatHour(active.time)} UTC</span>{mae!==null&&active.forecast!==null&&<small>Indicative MAE range {formatMw(Math.max(0,active.forecast-mae))}–{formatMw(active.forecast+mae)}</small>}<b>Forecast {formatMw(active.forecast)}</b><b>Actual {formatMw(active.actual)}</b></div>}</div><div className="profile-x-axis">{ticks.map((index)=><span key={rows[index].time}>{formatAxisTime(rows[index].time, spanHours)}</span>)}</div><div className="profile-range"><i /></div></div>
}
