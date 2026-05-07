import React, { useMemo } from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, CarFront, FileText, LayoutDashboard, Users, Wallet, Wrench, Package } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { usePalette, useTheme } from '../theme/ThemeProvider'
import { Button } from '../components/inline/Primitives'

import DashboardOverviewPage from './DashboardOverviewPage'
import ClientsPage from './ClientsPage'
import VehiclesPage from './VehiclesPage'
import BudgetsPage from './BudgetsPage'
import PaymentsPage from './PaymentsPage'
import ServiceWizardPage from './ServiceWizardPage'
import VehicleHistoryPage from './VehicleHistoryPage'
import ServiceCatalogPage from './ServiceCatalogPage'
import PartCatalogPage from './PartCatalogPage'

type NavItem = { key: string; label: string; to: string; icon: React.ReactNode }

export default function DashboardPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { mode, setMode } = useTheme()
  const p = usePalette()

  const navItems: NavItem[] = useMemo(
    () => [
      { key: 'dashboard', label: 'Dashboard', to: '/app/', icon: <LayoutDashboard size={18} /> },
      { key: 'clientes', label: 'Clientes', to: '/app/clientes', icon: <Users size={18} /> },
      { key: 'vehiculos', label: 'Vehículos', to: '/app/vehiculos', icon: <CarFront size={18} /> },
      { key: 'presupuestos', label: 'Presupuestos', to: '/app/presupuestos', icon: <FileText size={18} /> },
      { key: 'pagos', label: 'Pagos', to: '/app/pagos', icon: <Wallet size={18} /> },
      { key: 'servicios', label: 'Servicio', to: '/app/servicios', icon: <Wrench size={18} /> },
      { key: 'catalogo-servicios', label: 'Servicios (Catálogo)', to: '/app/catalogo-servicios', icon: <Wrench size={18} /> },
      { key: 'catalogo-repuestos', label: 'Repuestos (Catálogo)', to: '/app/catalogo-repuestos', icon: <Package size={18} /> },
    ],
    []
  )

  function isActive(to: string) {
    if (to === '/app/' || to === '/app') return location.pathname === '/app' || location.pathname === '/app/'
    return location.pathname.startsWith(to.replace(/\/$/, ''))
  }

  function doLogout() {
    logout()
    navigate('/login')
  }

  const sidebarIsDark = mode !== 'light'
  const asideBg = sidebarIsDark ? '#0F172A' : '#FFFFFF'
  const asideText = sidebarIsDark ? '#E5E7EB' : p.text

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <aside
        style={{
          width: 260,
          background: asideBg,
          color: asideText,
          borderRight: `1px solid ${sidebarIsDark ? 'rgba(255,255,255,0.10)' : p.sidebarBorder}`,
          padding: '20px 12px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 6px 18px 6px' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: sidebarIsDark ? 'rgba(2,6,23,0.35)' : 'rgba(37,99,235,0.08)',
              border: `1px solid ${sidebarIsDark ? 'rgba(255,255,255,0.10)' : 'rgba(37,99,235,0.18)'}`,
            }}
          >
            <Wrench size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 22, lineHeight: '20px', fontFamily: "'Iceland', sans-serif", letterSpacing: 0.5 }}>
              FERREIRA SPORT
            </div>
            <div style={{ fontSize: 14, opacity: 0.75 }}>Gestión Mecánica</div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 6px' }}>
          {navItems.map((item) => {
            const active = isActive(item.to)
            return (
              <Link
                key={item.key}
                to={item.to}
                style={{
                  padding: '10px 12px',
                  borderRadius: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: active ? p.primary : 'transparent',
                  color: active ? p.primaryText : asideText,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div style={{ marginTop: 18, padding: '0 6px' }}>
          <button
            type="button"
            onClick={doLogout}
            style={{
              width: '100%',
              borderRadius: 14,
              padding: '10px 12px',
              border: `1px solid ${sidebarIsDark ? 'rgba(255,255,255,0.12)' : p.cardBorder}`,
              background: 'transparent',
              color: asideText,
              fontWeight: 700,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
            }}
          >
            <LogOut size={18} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, background: p.background, color: p.text }}>
        <div style={{ padding: 24, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, lineHeight: '22px' }}>Sistema de Taller</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                Modo: <b>{mode}</b>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant={mode === 'light' ? 'primary' : 'outline'} size="sm" onClick={() => setMode('light')}>
                  Light
                </Button>
                <Button variant={mode === 'dark' ? 'primary' : 'outline'} size="sm" onClick={() => setMode('dark')}>
                  Dark
                </Button>
                <Button variant={mode === 'hybrid' ? 'primary' : 'outline'} size="sm" onClick={() => setMode('hybrid')}>
                  Hybrid
                </Button>
              </div>
            </div>
          </div>

          <Routes>
            <Route path="/" element={<DashboardOverviewPage />} />
            <Route path="clientes" element={<ClientsPage />} />
            <Route path="vehiculos" element={<VehiclesPage />} />
            <Route path="vehiculos/:vehicleId/historia" element={<VehicleHistoryPage />} />
            <Route path="presupuestos" element={<BudgetsPage />} />
            <Route path="pagos" element={<PaymentsPage />} />
            <Route path="servicios" element={<ServiceWizardPage />} />
            <Route path="catalogo-servicios" element={<ServiceCatalogPage />} />
            <Route path="catalogo-repuestos" element={<PartCatalogPage />} />
            <Route path="*" element={<DashboardOverviewPage />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

