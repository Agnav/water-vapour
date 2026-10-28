// In a combined deployment (Docker or Vercel), the API lives on this same
// origin. Keep the explicit local URL so `npm run dev` still works by itself.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ?? (import.meta.env.DEV ? 'http://127.0.0.1:8000' : window.location.origin)

export class ApiError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) { super(message); this.name = 'ApiError'; this.status = status }
}

export async function apiGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(path, API_BASE_URL)
  for (const [key, value] of Object.entries(params)) {
    // Pass raw values here. URLSearchParams performs the one required encoding.
    url.searchParams.set(key, value)
  }
  const response = await fetch(url)
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try { const payload: unknown = await response.json(); if (typeof payload === 'object' && payload !== null && 'detail' in payload) message = String(payload.detail) } catch { /* Use the HTTP-status fallback. */ }
    throw new ApiError(message, response.status)
  }
  return response.json() as Promise<T>
}
