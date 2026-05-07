import React, { useEffect, useMemo, useState } from 'react'
import { Button, Badge, Card, CardSection, Input } from '../components/inline/Primitives'
import { CheckCircle2, Clock3, CarFront, FileText, DollarSign, Wrench, CalendarRange } from 'lucide-react'
import { usePalette } from '../theme/ThemeProvider'
import { useAuth } from '../auth/useAuth'
import { api } from '../api/client'

function money(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

type DatePreset = 'WEEK' | 'MONTH' | 'SIX_MONTHS' | 'YEAR' | 'CUSTOM'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Inicio del día local en ms (comparar con timestamps de API). */
function startOfLocalDayFromYmd(ymd: string): number {
  const [y, m, day] = ymd.split('-').map(Number)
  if (!y || !m || !day) return NaN
  return new Date(y, m - 1, day, 0, 0, 0, 0).getTime()
}

function endOfLocalDayFromYmd(ymd: string): number {
  const [y, m, day] = ymd.split('-').map(Number)
  if (!y || !m || !day) return NaN
  return new Date(y, m - 1, day, 23, 59, 59, 999).getTime()
}

function inLocalYmdRange(iso: string | undefined, from: string, to: string): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  const a = startOfLocalDayFromYmd(from)
  const b = endOfLocalDayFromYmd(to)
  if (Number.isNaN(t) || Number.isNaN(a) || Number.isNaN(b)) return false
  return t >= a && t <= b
}

function computePresetRange(preset: Exclude<DatePreset, 'CUSTOM'>): { from: string; to: string } {
  const end = new Date()
  end.setHours(12, 0, 0, 0)
  const to = ymdLocal(end)
  const start = new Date(end)
  switch (preset) {
    case 'WEEK':
      start.setDate(start.getDate() - 6)
      break
    case 'MONTH':
      start.setDate(start.getDate() - 29)
      break
    case 'SIX_MONTHS':
      start.setMonth(start.getMonth() - 6)
      break
    case 'YEAR':
      start.setFullYear(start.getFullYear() - 1)
      break
    default:
      break
  }
  return { from: ymdLocal(start), to }
}

type PaymentRow = {
  id: string
  amount: string | number
  paidAt: string
  customerId?: string | null
  vehicleId?: string | null
  note?: string | null
  reference?: string | null
}

type BudgetRow = {
  id: string
  status: string
  createdAt?: string
  customerId?: string | null
  vehicleId?: string | null
}

function toNumber(v: unknown) {
  const n = typeof v === 'string' ? Number.parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}

function formatWhen(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

const PRESET_LABELS: Record<Exclude<DatePreset, 'CUSTOM'>, string> = {
  WEEK: 'Última semana',
  MONTH: 'Último mes',
  SIX_MONTHS: 'Últimos 6 meses',
  YEAR: 'Último año',
}

function chipStyle(active: boolean) {
  return {
    height: 34,
    padding: '0 14px',
    borderRadius: 999,
    border: '1px solid rgba(15,23,42,0.15)',
    background: active ? '#2563EB' : 'transparent',
    color: active ? '#fff' : 'inherit',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer' as const,
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: 6,
  }
}

export default function DashboardOverviewPage() {
  const p = usePalette()
  const { token } = useAuth()

  const [preset, setPreset] = useState<DatePreset>('WEEK')
  const [customFrom, setCustomFrom] = useState(() => {
    const end = new Date()
    end.setHours(12, 0, 0, 0)
    const start = new Date(end)
    start.setDate(start.getDate() - 29)
    return ymdLocal(start)
  })
  const [customTo, setCustomTo] = useState(() => {
    const end = new Date()
    end.setHours(12, 0, 0, 0)
    return ymdLocal(end)
  })

  const range = useMemo(() => {
    if (preset === 'CUSTOM') {
      const f = customFrom.trim()
      const t = customTo.trim()
      if (!f || !t) return computePresetRange('MONTH')
      return f <= t ? { from: f, to: t } : { from: t, to: f }
    }
    return computePresetRange(preset)
  }, [preset, customFrom, customTo])

  const rangeLabel = useMemo(() => {
    const a = new Date(range.from + 'T12:00:00')
    const b = new Date(range.to + 'T12:00:00')
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return ''
    return `${a.toLocaleDateString('es-AR')} — ${b.toLocaleDateString('es-AR')}`
  }, [range.from, range.to])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [customers, setCustomers] = useState<Array<{ id: string; name?: string | null }>>([])
  const [vehicles, setVehicles] = useState<Array<{ id: string; plate: string }>>([])

  useEffect(() => {
    const t = token
    if (!t) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [payRes, budRes, custRes, vehRes] = await Promise.all([
          api.payments.list(t, { from: range.from, to: range.to }),
          api.budgets.list(t),
          api.customers.list(t),
          api.vehicles.list(t),
        ])
        if (cancelled) return
        setPayments((payRes.data || []) as PaymentRow[])
        setBudgets((budRes.data || []) as BudgetRow[])
        setCustomers(custRes.data || [])
        setVehicles(vehRes.data || [])
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar el dashboard')
          setPayments([])
          setBudgets([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, range.from, range.to])

  const customerName = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of customers) m.set(c.id, c.name || c.id)
    return m
  }, [customers])

  const vehiclePlate = useMemo(() => {
    const m = new Map<string, string>()
    for (const v of vehicles) m.set(v.id, v.plate)
    return m
  }, [vehicles])

  const budgetsInRange = useMemo(
    () => budgets.filter((b) => inLocalYmdRange(b.createdAt, range.from, range.to)),
    [budgets, range.from, range.to]
  )

  const ingresos = useMemo(() => payments.reduce((acc, x) => acc + toNumber(x.amount), 0), [payments])
  const cantidadPagos = payments.length

  const clientesActivos = useMemo(() => {
    const ids = new Set<string>()
    for (const pmt of payments) {
      if (pmt.customerId) ids.add(pmt.customerId)
    }
    for (const b of budgetsInRange) {
      if (b.customerId) ids.add(b.customerId)
    }
    return ids.size
  }, [payments, budgetsInRange])

  const vehiculosActivos = useMemo(() => {
    const ids = new Set<string>()
    for (const pmt of payments) {
      if (pmt.vehicleId) ids.add(pmt.vehicleId)
    }
    for (const b of budgetsInRange) {
      if (b.vehicleId) ids.add(b.vehicleId)
    }
    return ids.size
  }, [payments, budgetsInRange])

  const presupuestosPendientes = useMemo(
    () => budgetsInRange.filter((b) => String(b.status).toUpperCase() === 'PENDIENTE').length,
    [budgetsInRange]
  )

  const actividadItems = useMemo(() => {
    type Item = { key: string; when: string; who: string; what: string; sub: string; kind: 'pago' | 'presupuesto' }
    const items: Item[] = []
    for (const pmt of payments) {
      const who = pmt.customerId ? customerName.get(pmt.customerId) || 'Cliente' : 'Sin cliente'
      const plate = pmt.vehicleId ? vehiclePlate.get(pmt.vehicleId) : null
      items.push({
        key: `p-${pmt.id}`,
        when: pmt.paidAt,
        who,
        what: `Pago ${money(toNumber(pmt.amount))}`,
        sub: [plate && `Pat. ${plate}`, pmt.reference].filter(Boolean).join(' · ') || '—',
        kind: 'pago',
      })
    }
    for (const b of budgetsInRange) {
      const who = b.customerId ? customerName.get(b.customerId) || 'Cliente' : 'Sin cliente'
      const plate = b.vehicleId ? vehiclePlate.get(b.vehicleId) : null
      items.push({
        key: `b-${b.id}`,
        when: b.createdAt || '',
        who,
        what: `Presupuesto (${b.status})`,
        sub: plate ? `Pat. ${plate}` : '—',
        kind: 'presupuesto',
      })
    }
    items.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
    return items.slice(0, 12)
  }, [payments, budgetsInRange, customerName, vehiclePlate])

  const statCard = (title: string, value: string, subtitle: string, icon: React.ReactNode, iconBg: string) => (
    <Card style={{ borderColor: p.cardBorder }}>
      <CardSection style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>{title}</div>
            <div style={{ fontSize: 34, fontWeight: 900, marginTop: 6, lineHeight: '38px' }}>{value}</div>
            <div style={{ fontSize: 14, opacity: 0.7, marginTop: 2 }}>{subtitle}</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </div>
        </div>
      </CardSection>
    </Card>
  )

  const rowCard = (who: string, what: string, sub: string, when: string, kind: 'pago' | 'presupuesto') => (
    <div style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 14, border: `1px solid ${p.cardBorder}`, background: 'transparent' }}>
      <div style={{ width: 36, height: 36, borderRadius: 14, background: 'rgba(59,130,246,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60A5FA' }}>
        {kind === 'pago' ? <DollarSign size={18} /> : <FileText size={18} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{who}</div>
        <div style={{ fontSize: 13, opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{what}</div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>{sub}</div>
        <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>{when}</div>
      </div>
      <Badge label={kind === 'pago' ? 'Pago' : 'Presup.'} tone={kind === 'pago' ? 'success' : 'warning'} />
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 26, fontWeight: 900 }}>Dashboard</div>
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Bienvenido al sistema de gestión del taller</div>
        <div style={{ fontSize: 14, opacity: 0.65, marginTop: 6 }}>{rangeLabel}</div>
      </div>

      <Card style={{ borderColor: p.cardBorder, marginBottom: 16 }}>
        <CardSection style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <CalendarRange size={18} style={{ opacity: 0.85 }} />
            <div style={{ fontSize: 14, fontWeight: 900 }}>Periodo</div>
            {loading ? <span style={{ fontSize: 14, opacity: 0.65 }}>Actualizando…</span> : null}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: preset === 'CUSTOM' ? 14 : 0 }}>
            {(Object.keys(PRESET_LABELS) as Array<Exclude<DatePreset, 'CUSTOM'>>).map((key) => (
              <button key={key} type="button" style={chipStyle(preset === key)} onClick={() => setPreset(key)}>
                {PRESET_LABELS[key]}
              </button>
            ))}
            <button type="button" style={chipStyle(preset === 'CUSTOM')} onClick={() => setPreset('CUSTOM')}>
              Personalizado
            </button>
          </div>
          {preset === 'CUSTOM' ? (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 14, fontWeight: 700, opacity: 0.85 }}>Desde</label>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 14, fontWeight: 700, opacity: 0.85 }}>Hasta</label>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </div>
          ) : null}
        </CardSection>
      </Card>

      {error ? (
        <Card style={{ borderColor: 'rgba(239,68,68,0.35)', marginBottom: 16 }}>
          <CardSection style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#FCA5A5' }}>{error}</div>
          </CardSection>
        </Card>
      ) : null}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: 16 }}>
        {statCard(
          'Clientes con actividad',
          loading ? '…' : String(clientesActivos),
          'Con pagos o presupuestos en el periodo',
          <Wrench size={18} color="#60A5FA" />,
          'rgba(59,130,246,0.12)'
        )}
        {statCard(
          'Vehículos con movimiento',
          loading ? '…' : String(vehiculosActivos),
          'Distintos vehículos en pagos/presupuestos',
          <CarFront size={18} color="#34D399" />,
          'rgba(16,185,129,0.12)'
        )}
        {statCard(
          'Presupuestos pendientes',
          loading ? '…' : String(presupuestosPendientes),
          'Estado PENDIENTE y fecha en el periodo',
          <FileText size={18} color="#FBBF24" />,
          'rgba(245,158,11,0.12)'
        )}
        {statCard(
          'Ingresos por cobros',
          loading ? '…' : cantidadPagos === 0 ? '—' : money(ingresos),
          `${cantidadPagos} pago${cantidadPagos === 1 ? '' : 's'} · según fecha de cobro`,
          <DollarSign size={18} color="#C4B5FD" />,
          'rgba(139,92,246,0.12)'
        )}
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
        <Card>
          <CardSection style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>Actividad en el periodo</div>
              <Button variant="outline" size="sm" disabled>
                Ver todo
              </Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              {loading ? (
                <div style={{ fontSize: 13, opacity: 0.7 }}>Cargando…</div>
              ) : actividadItems.length === 0 ? (
                <div style={{ fontSize: 13, opacity: 0.7 }}>Sin movimientos en este periodo.</div>
              ) : (
                actividadItems.map((it) => rowCard(it.who, it.what, it.sub, formatWhen(it.when), it.kind))
              )}
            </div>
          </CardSection>
        </Card>

        <Card>
          <CardSection style={{ padding: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>Alertas y Notificaciones</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              {presupuestosPendientes > 0 ? (
                <div style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 14, border: `1px solid rgba(245,158,11,0.35)`, background: 'rgba(245,158,11,0.06)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 14, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FBBF24' }}>
                    <Clock3 size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 14 }}>{presupuestosPendientes} presupuesto(s) pendiente(s)</div>
                    <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>Creados en el periodo seleccionado · Revisá la sección Presupuestos</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 14, border: `1px solid ${p.cardBorder}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: 14, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34D399' }}>
                    <CheckCircle2 size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>Sin pendientes en el periodo</div>
                    <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>No hay presupuestos PENDIENTE con fecha de alta en este rango.</div>
                  </div>
                </div>
              )}
            </div>
          </CardSection>
        </Card>
      </div>
    </div>
  )
}
