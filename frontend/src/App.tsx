import { useState } from 'react'
import DashboardPage from './pages/DashboardPage'
import ForecastsPage from './pages/ForecastsPage'
import './App.css'

export default function App() {
  const [page, setPage] = useState<'dashboard' | 'forecasts'>('dashboard')
  return <div className="layout"><aside className="sidebar"><div className="brand"><span className="brand-icon">W</span><span>Wind<span>forecast</span></span></div><div className="nav-label">WORKSPACE</div><nav aria-label="Main navigation"><button className={page === 'dashboard' ? 'selected' : ''} onClick={() => setPage('dashboard')}><span>▦</span>Dashboard</button><button className={page === 'forecasts' ? 'selected' : ''} onClick={() => setPage('forecasts')}><span>⌁</span>Forecast</button></nav><div className="sidebar-footer"><span className="status-dot" /> Live generation data</div></aside><main className="main-content">{page === 'dashboard' ? <DashboardPage /> : <ForecastsPage />}</main></div>
}
