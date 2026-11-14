import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import './style.css'
import Home from './pages/Home.jsx'
import LotPage from './pages/LotPage.jsx'
import VoucherPage from './pages/VoucherPage.jsx'
import ShuttlePage from './pages/ShuttlePage.jsx'
import AdminPage from './pages/AdminPage.jsx'

function NotFound() {
  return (
    <main className="page">
      <h1>페이지를 찾을 수 없어요</h1>
      <Link className="btn primary" to="/">처음 화면으로</Link>
    </main>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/p/:code" element={<LotPage />} />
        <Route path="/v/:code" element={<VoucherPage />} />
        <Route path="/shuttle" element={<ShuttlePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
