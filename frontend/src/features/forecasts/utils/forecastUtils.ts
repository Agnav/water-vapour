import type { ForecastQuery, PublicationStrategy } from '../types/forecast'
export const strategies: { value: PublicationStrategy; label: string }[] = [{ value: 'latest', label: 'Latest publication' }, { value: 'earliest', label: 'Earliest publication' }, { value: 'highest', label: 'Highest forecast' }, { value: 'lowest', label: 'Lowest forecast' }]
export function defaultQuery(): ForecastQuery { const end = new Date(); end.setUTCMinutes(0, 0, 0); const start = new Date(end); start.setUTCDate(start.getUTCDate() - 1); return { from: start.toISOString(), to: end.toISOString(), publication_strategy: 'latest' } }
export const formatMw = (value: number | null) => value === null ? '—' : `${Math.round(value).toLocaleString()} MW`
export const formatTime = (value: string) => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })
