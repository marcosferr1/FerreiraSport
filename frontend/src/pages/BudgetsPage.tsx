import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, FileText, Plus, Search, Trash2, Wallet, Wrench, XCircle } from 'lucide-react'
import { Badge, Button, Card, CardSection, CircularProgress, Input, Modal, Select, Textarea } from '../components/inline/Primitives'
import { useAuth } from '../auth/useAuth'
import { api } from '../api/client'
import { usePalette } from '../theme/ThemeProvider'
import { useNavigate } from 'react-router-dom'

type BudgetStatus = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'

type BudgetLine = {
  description: string
  qty?: number | string
  unitPrice?: number | string
  lineTotal?: number | string
}

type BudgetApi = {
  id: string
  customerId?: string | null
  vehicleId?: string | null
  status: BudgetStatus | string
  createdAt?: string
  BudgetLines?: BudgetLine[]
  total?: string | number
}

type ServiceItem = {
  key: string
  serviceCatalogId: string
  isNew: boolean
  name: string
  laborPrice: string
  notes: string
}
type PartItem = {
  key: string
  partCatalogId: string
  isNew: boolean
  name: string
  brand: string
  sku: string
  qty: string
  unitPrice: string
  notes: string
}

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

function formatMoney(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

function formatDate(value: unknown) {
  if (!value) return '—'
  const d = new Date(value as any)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('es-AR')
}

function shortId(id: string) {
  return id.length > 8 ? id.slice(0, 8).toUpperCase() : id.toUpperCase()
}

function surnameFromName(fullName: string) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return parts.length ? parts[parts.length - 1] : 'Cliente'
}

function sanitize(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function paymentNavigateStateFromBudget(b: BudgetApi) {
  const totalNumber = b.total == null ? 0 : Number(b.total)
  return {
    budgetId: b.id,
    customerId: b.customerId || undefined,
    vehicleId: b.vehicleId || undefined,
    suggestedAmount: Number.isFinite(totalNumber) ? totalNumber : undefined,
  }
}

export default function BudgetsPage() {
  const p = usePalette()
  const navigate = useNavigate()
  const { token } = useAuth()

  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'TODOS' | BudgetStatus>('TODOS')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [budgets, setBudgets] = useState<BudgetApi[]>([])
  const [customers, setCustomers] = useState<Array<{ id: string; name?: string | null }>>([])
  const [vehicles, setVehicles] = useState<Array<{ id: string; plate: string; make?: string | null; model?: string | null; customerId?: string | null }>>([])
  const [serviceCatalog, setServiceCatalog] = useState<Array<{ id: string; name: string; suggestedPrice?: number | string | null }>>([])
  const [partCatalog, setPartCatalog] = useState<Array<{ id: string; name: string; brand?: string | null; sku?: string | null; suggestedPrice?: number | string | null }>>([])
  const [mutatingBudgetId, setMutatingBudgetId] = useState<string | null>(null)

  const [detailBudget, setDetailBudget] = useState<BudgetApi | null>(null)

  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [creatingBudget, setCreatingBudget] = useState(false)
  const [wizardError, setWizardError] = useState<string | null>(null)

  const [customerId, setCustomerId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [odometer, setOdometer] = useState('')
  const [receivedAt, setReceivedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [notes, setNotes] = useState('')
  const [services, setServices] = useState<ServiceItem[]>([])
  const [parts, setParts] = useState<PartItem[]>([])
  const [lastVehicleOdometer, setLastVehicleOdometer] = useState<number | null>(null)

  useEffect(() => {
    const t = token
    if (!t) return
    let cancelled = false

    async function loadLookups() {
      const [customersRes, vehiclesRes, sRes, pRes] = await Promise.all([
        api.customers.list(t!),
        api.vehicles.list(t!),
        api.serviceCatalog.list(t!),
        api.partCatalog.list(t!),
      ])
      if (cancelled) return
      setCustomers(customersRes.data || [])
      setVehicles(vehiclesRes.data || [])
      setServiceCatalog(sRes.data || [])
      setPartCatalog(pRes.data || [])
    }

    loadLookups().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [token])

  async function loadBudgets() {
    const t = token
    if (!t) return
    setLoading(true)
    setError(null)
    try {
      const status = tab === 'TODOS' ? undefined : tab
      const res = await api.budgets.list(t, { status })
      setBudgets(res.data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar presupuestos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBudgets()
  }, [token, tab])

  useEffect(() => {
    const t = token
    if (!t || !vehicleId) {
      setLastVehicleOdometer(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.vehicles.history(t, vehicleId)
        if (cancelled) return
        const timeline = Array.isArray(res?.data?.timeline) ? res.data.timeline : []
        const last = timeline.find((x: any) => x?.intake?.odometer != null)
        const n = Number(last?.intake?.odometer)
        setLastVehicleOdometer(Number.isFinite(n) ? n : null)
      } catch {
        if (!cancelled) setLastVehicleOdometer(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, vehicleId])

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of customers) map.set(c.id, c.name || '')
    return map
  }, [customers])

  const vehicleLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of vehicles) {
      const partsLabel = [v.make, v.model].filter(Boolean).join(' ')
      map.set(v.id, `${v.plate}${partsLabel ? ` • ${partsLabel}` : ''}`)
    }
    return map
  }, [vehicles])

  const vehiclesForCustomer = useMemo(
    () => vehicles.filter((v) => (customerId ? v.customerId === customerId : true)),
    [vehicles, customerId]
  )
  const selectedCustomerHasVehicles = customerId ? vehiclesForCustomer.length > 0 : true

  const laborTotal = useMemo(() => services.reduce((acc, s) => acc + (Number(s.laborPrice) || 0), 0), [services])
  const partsTotal = useMemo(() => parts.reduce((acc, x) => acc + (Number(x.qty) || 0) * (Number(x.unitPrice) || 0), 0), [parts])
  const grandTotal = laborTotal + partsTotal

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return budgets
    return budgets.filter((b) => {
      const code = shortId(b.id).toLowerCase()
      const customer = b.customerId ? (customerNameById.get(b.customerId) || '').toLowerCase() : ''
      const vehicle = b.vehicleId ? (vehicleLabelById.get(b.vehicleId) || '').toLowerCase() : ''
      const description = (b.BudgetLines?.[0]?.description || '').toLowerCase()
      return [code, customer, vehicle, description].some((x) => x.includes(q))
    })
  }, [budgets, query, customerNameById, vehicleLabelById])

  function resetWizard() {
    setWizardStep(1)
    setWizardError(null)
    setCustomerId(customers[0]?.id || '')
    setVehicleId('')
    setOdometer('')
    setReceivedAt(new Date().toISOString().slice(0, 16))
    setNotes('')
    setServices([])
    setParts([])
    setLastVehicleOdometer(null)
  }

  function validateStep(step: number) {
    if (step === 1 && !customerId) return 'Elegí un cliente para continuar.'
    if (step === 1 && !selectedCustomerHasVehicles) return 'El cliente seleccionado no tiene vehículos asociados.'
    if (step === 2) {
      if (!vehicleId) return 'Elegí un vehículo del cliente.'
      if (!odometer.trim()) return 'Ingresá el kilometraje.'
      if (!receivedAt) return 'Ingresá la fecha/hora.'
      const currentOdometer = Number(odometer)
      if (!Number.isFinite(currentOdometer) || currentOdometer < 0) return 'Kilometraje inválido.'
      if (lastVehicleOdometer != null && currentOdometer < lastVehicleOdometer) {
        return `El kilometraje no puede ser menor al último registro (${lastVehicleOdometer}).`
      }
    }
    if (step === 3 && services.length === 0) return 'Agregá al menos un servicio.'
    if (step === 4 && parts.length === 0) return 'Agregá al menos un repuesto.'
    return null
  }

  async function createServiceCatalogInline(item: ServiceItem) {
    const t = token
    if (!t) return null
    const cleanName = item.name.trim()
    if (!cleanName) return null
    const res = await api.serviceCatalog.create(t, {
      name: cleanName,
      suggestedPrice: item.laborPrice ? Number(item.laborPrice) : null,
    })
    setServiceCatalog((prev) => {
      const exists = prev.some((x) => x.id === res.data.id)
      return exists ? prev : [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name))
    })
    return res.data
  }

  async function createPartCatalogInline(item: PartItem) {
    const t = token
    if (!t) return null
    const cleanName = item.name.trim()
    if (!cleanName) return null
    const res = await api.partCatalog.create(t, {
      name: cleanName,
      brand: item.brand.trim() || null,
      sku: item.sku.trim() || null,
      suggestedPrice: item.unitPrice ? Number(item.unitPrice) : null,
    })
    setPartCatalog((prev) => {
      const exists = prev.some((x) => x.id === res.data.id)
      return exists ? prev : [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name))
    })
    return res.data
  }

  async function onUpdateStatus(budgetId: string, newStatus: BudgetStatus) {
    const t = token
    if (!t) return
    setMutatingBudgetId(budgetId)
    try {
      await api.budgets.updateStatus(t, budgetId, { newStatus, reason: null })
      await loadBudgets()
    } finally {
      setMutatingBudgetId(null)
    }
  }

  function toServicePrefill(b: BudgetApi) {
    const servicesPrefill = (b.BudgetLines || [])
      .filter((line) => line.description?.startsWith('Servicio:'))
      .map((line) => ({
        name: line.description.replace('Servicio:', '').trim(),
        laborPrice: String(Number(line.unitPrice) || Number(line.lineTotal) || 0),
        notes: '',
      }))

    const partsPrefill = (b.BudgetLines || [])
      .filter((line) => line.description?.startsWith('Repuesto:'))
      .map((line) => ({
        name: line.description.replace('Repuesto:', '').trim(),
        brand: '',
        sku: '',
        qty: String(Number(line.qty) || 1),
        unitPrice: String(Number(line.unitPrice) || 0),
        notes: '',
      }))

    return {
      budgetId: b.id,
      customerId: b.customerId || '',
      vehicleId: b.vehicleId || '',
      services: servicesPrefill,
      parts: partsPrefill,
    }
  }

  function printBudget(b: BudgetApi) {
    const customer = b.customerId ? customerNameById.get(b.customerId) || '—' : '—'
    const vehicle = b.vehicleId ? vehicleLabelById.get(b.vehicleId) || '—' : '—'
    const plate = b.vehicleId ? (vehicles.find((v) => v.id === b.vehicleId)?.plate || 'Sin placa') : 'Sin placa'
    const surname = surnameFromName(customer)
    const budgetDate = formatDate(b.createdAt)
    const displayName = `${plate} | ${surname} | ${budgetDate}`
    const lines = (b.BudgetLines || [])
      .map((l) => {
        const qty = Number(l.qty) || 1
        const unit = Number(l.unitPrice) || 0
        const total = Number(l.lineTotal) || qty * unit
        return `<tr><td>${sanitize(l.description)}</td><td>${qty}</td><td>${formatMoney(unit)}</td><td>${formatMoney(total)}</td></tr>`
      })
      .join('')
    const total = Number(b.total) || (b.BudgetLines || []).reduce((acc, l) => acc + (Number(l.lineTotal) || 0), 0)

    const logoUrl = `${window.location.origin}/ferreira-logo.png`
    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Presupuesto ${sanitize(displayName)}</title><style>body{font-family:Arial,sans-serif;padding:24px}.head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.logo{width:190px;max-width:38vw;object-fit:contain}h1{margin:0 0 8px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.meta{color:#444;margin-bottom:12px}.total{margin-top:16px;font-size:18px;font-weight:700;text-align:right}</style></head><body><div class="head"><div><h1>Presupuesto ${sanitize(displayName)}</h1><div class="meta">Cliente: ${sanitize(customer)}<br/>Vehículo: ${sanitize(vehicle)}<br/>Fecha: ${sanitize(formatDate(b.createdAt))}</div></div><img src="${logoUrl}" class="logo" alt="FERREIRA SPORT" /></div><table><thead><tr><th>Descripción</th><th>Cant.</th><th>Unit.</th><th>Total</th></tr></thead><tbody>${lines}</tbody></table><div class="total">Total: ${formatMoney(total)}</div><script>window.onload=()=>window.print()</script></body></html>`

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.setAttribute('aria-hidden', 'true')
    document.body.appendChild(iframe)

    const frameDoc = iframe.contentWindow?.document
    if (!frameDoc || !iframe.contentWindow) {
      document.body.removeChild(iframe)
      setError('No se pudo abrir la impresión del PDF en este navegador.')
      return
    }

    frameDoc.open()
    frameDoc.write(html)
    frameDoc.close()

    window.setTimeout(() => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      window.setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe)
      }, 1200)
    }, 150)
  }

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>Presupuestos</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Stepper de presupuesto y gestión de estados</div>
        </div>
        <Button
          disabled={loading}
          onClick={() => {
            resetWizard()
            setWizardOpen(true)
          }}
        >
          + Nuevo Presupuesto
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.7 }}>
            <Search size={16} />
          </div>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por número, cliente o vehículo..." style={{ paddingLeft: 40 }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {(['TODOS', 'PENDIENTE', 'APROBADO', 'RECHAZADO'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t === 'TODOS' ? 'TODOS' : (t as BudgetStatus))}
            style={{
              height: 34,
              padding: '0 12px',
              borderRadius: 999,
              border: '1px solid rgba(15,23,42,0.15)',
              background: tab === t ? '#2563EB' : 'transparent',
              color: tab === t ? '#fff' : 'inherit',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {t === 'TODOS' ? 'Todos' : t === 'PENDIENTE' ? 'Pendiente' : t === 'APROBADO' ? 'Aprobado' : 'Rechazado'}
          </button>
        ))}
      </div>

      {loading ? (
        <Card>
          <CardSection>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CircularProgress size={24} />
              <div style={{ fontWeight: 900 }}>Cargando…</div>
            </div>
          </CardSection>
        </Card>
      ) : error ? (
        <Card style={{ borderColor: 'rgba(239,68,68,0.35)' }}><CardSection>{error}</CardSection></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map((b) => {
            const status = String(b.status) as BudgetStatus
            const tone = status === 'APROBADO' ? 'success' : status === 'RECHAZADO' ? 'danger' : 'warning'
            const totalNumber = b.total == null ? 0 : Number(b.total)
            const customerLabel = b.customerId ? customerNameById.get(b.customerId) || '' : ''
            const surname = surnameFromName(customerLabel)
            const plate = b.vehicleId ? (vehicles.find((v) => v.id === b.vehicleId)?.plate || 'Sin placa') : 'Sin placa'
            const code = `${plate} | ${surname} | ${formatDate(b.createdAt)}`

            return (
              <Card key={b.id}>
                <CardSection style={{ padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(37,99,235,0.10)', border: '1px solid rgba(37,99,235,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 900 }}>{code}</div>
                        <div style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>{b.customerId ? customerNameById.get(b.customerId) || '—' : '—'}</div>
                        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9, fontWeight: 800 }}>{b.vehicleId ? vehicleLabelById.get(b.vehicleId) || '—' : '—'}</div>
                        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>Fecha: {formatDate(b.createdAt)} | <span style={{ fontWeight: 900 }}>{formatMoney(totalNumber)}</span></div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                      <Badge label={status === 'PENDIENTE' ? 'Pendiente' : status === 'APROBADO' ? 'Aprobado' : 'Rechazado'} tone={tone as any} />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Button size="sm" variant="outline" onClick={() => setDetailBudget(b)}>Ver detalle</Button>
                        <Button size="sm" variant="outline" onClick={() => printBudget(b)}>PDF</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate('/app/pagos', {
                              state: paymentNavigateStateFromBudget(b),
                            })
                          }
                        >
                          <Wallet size={14} /> Registrar pago
                        </Button>
                        {status === 'APROBADO' ? (
                          <Button size="sm" onClick={() => navigate('/app/servicios', { state: { prefill: toServicePrefill(b) } })}>
                            <Wrench size={14} /> Generar servicio
                          </Button>
                        ) : null}
                        {status === 'PENDIENTE' ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              style={{ borderColor: 'rgba(16,185,129,0.35)', color: '#34D399' }}
                              disabled={mutatingBudgetId === b.id}
                              onClick={() => onUpdateStatus(b.id, 'APROBADO')}
                            >
                              <CheckCircle2 size={16} /> Aprobar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              style={{ borderColor: 'rgba(239,68,68,0.35)', color: '#FCA5A5' }}
                              disabled={mutatingBudgetId === b.id}
                              onClick={() => onUpdateStatus(b.id, 'RECHAZADO')}
                            >
                              <XCircle size={16} /> Rechazar
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardSection>
              </Card>
            )
          })}

          {!loading && filtered.length === 0 ? (
            <Card><CardSection>Sin presupuestos.</CardSection></Card>
          ) : null}
        </div>
      )}

      <Modal open={wizardOpen} title="Nuevo Presupuesto" onClose={() => !creatingBudget && setWizardOpen(false)}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {['Cliente', 'Vehículo', 'Servicios', 'Repuestos', 'Resumen'].map((label, i) => (
            <div key={label} style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(100,116,139,0.25)', background: wizardStep === i + 1 ? '#2563EB' : 'transparent', color: wizardStep === i + 1 ? '#fff' : 'inherit', fontSize: 14, fontWeight: 700 }}>
              {i + 1}. {label}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {wizardStep === 1 ? (
            <>
              <label style={{ fontSize: 13, fontWeight: 700 }}>Cliente</label>
              <Select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setVehicleId('') }}>
                <option value="">— Elegir cliente —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
              </Select>
              {customerId && !selectedCustomerHasVehicles ? (
                <div style={{ marginTop: 10, border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.12)', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Este cliente no tiene vehículos asociados.</div>
                  <Button size="sm" variant="outline" onClick={() => navigate('/app/vehiculos')}>
                    Ir a Vehículos para cargar uno
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}

          {wizardStep === 2 ? (
            <>
              <label style={{ fontSize: 13, fontWeight: 700 }}>Vehículo del cliente</label>
              <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">— Elegir vehículo —</option>
                {vehiclesForCustomer.map((v) => <option key={v.id} value={v.id}>{v.plate} {[v.make, v.model].filter(Boolean).join(' ')}</option>)}
              </Select>
              {!selectedCustomerHasVehicles ? (
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  No hay vehículos para este cliente. Primero cargá uno en la sección Vehículos.
                </div>
              ) : null}
              <Input value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="Kilometraje" />
              {lastVehicleOdometer != null ? (
                <div style={{ marginTop: -2, fontSize: 14, opacity: 0.75 }}>Último registrado: {lastVehicleOdometer}</div>
              ) : null}
              <Input type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas del presupuesto" />
            </>
          ) : null}

          {wizardStep === 3 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <b>Servicios</b>
                <Button
                  size="sm"
                  onClick={() =>
                    setServices((prev) => [...prev, { key: uid(), serviceCatalogId: '', isNew: false, name: '', laborPrice: '0', notes: '' }])
                  }
                >
                  <Plus size={14} /> Agregar
                </Button>
              </div>
              {services.map((s, idx) => (
                <Card key={s.key} style={{ borderColor: p.cardBorder }}>
                  <CardSection style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <b>Servicio #{idx + 1}</b>
                      <Button size="sm" variant="outline" onClick={() => setServices((prev) => prev.filter((x) => x.key !== s.key))}><Trash2 size={14} /></Button>
                    </div>
                    <Select
                      value={s.serviceCatalogId}
                      onChange={(e) => {
                        const v = e.target.value
                        setServices((prev) =>
                          prev.map((x) => {
                            if (x.key !== s.key) return x
                            if (!v) return { ...x, serviceCatalogId: '', isNew: true, name: '' }
                            const cat = serviceCatalog.find((c) => c.id === v)
                            return {
                              ...x,
                              serviceCatalogId: v,
                              isNew: false,
                              name: cat?.name || x.name,
                              laborPrice: String(cat?.suggestedPrice ?? x.laborPrice),
                            }
                          })
                        )
                      }}
                    >
                      <option value="">Nuevo servicio (escribir)</option>
                      {serviceCatalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                    {!s.serviceCatalogId ? (
                      <Input value={s.name} onChange={(e) => setServices((prev) => prev.map((x) => x.key === s.key ? { ...x, name: e.target.value } : x))} placeholder="Nombre del servicio" />
                    ) : null}
                    <Input value={s.laborPrice} onChange={(e) => setServices((prev) => prev.map((x) => x.key === s.key ? { ...x, laborPrice: e.target.value } : x))} placeholder="Precio mano de obra" />
                    <Input value={s.notes} onChange={(e) => setServices((prev) => prev.map((x) => x.key === s.key ? { ...x, notes: e.target.value } : x))} placeholder="Notas" />
                  </CardSection>
                </Card>
              ))}
            </>
          ) : null}

          {wizardStep === 4 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <b>Repuestos</b>
                <Button
                  size="sm"
                  onClick={() =>
                    setParts((prev) => [
                      ...prev,
                      { key: uid(), partCatalogId: '', isNew: false, name: '', brand: '', sku: '', qty: '1', unitPrice: '0', notes: '' },
                    ])
                  }
                >
                  <Plus size={14} /> Agregar
                </Button>
              </div>
              {parts.map((part, idx) => (
                <Card key={part.key} style={{ borderColor: p.cardBorder }}>
                  <CardSection style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <b>Repuesto #{idx + 1}</b>
                      <Button size="sm" variant="outline" onClick={() => setParts((prev) => prev.filter((x) => x.key !== part.key))}><Trash2 size={14} /></Button>
                    </div>
                    <Select
                      value={part.partCatalogId}
                      onChange={(e) => {
                        const v = e.target.value
                        setParts((prev) =>
                          prev.map((x) => {
                            if (x.key !== part.key) return x
                            if (!v) return { ...x, partCatalogId: '', isNew: true, name: '', brand: '', sku: '' }
                            const cat = partCatalog.find((c) => c.id === v)
                            return {
                              ...x,
                              partCatalogId: v,
                              isNew: false,
                              name: cat?.name || x.name,
                              brand: cat?.brand || '',
                              sku: cat?.sku || '',
                              unitPrice: String(cat?.suggestedPrice ?? x.unitPrice),
                            }
                          })
                        )
                      }}
                    >
                      <option value="">Nuevo repuesto (escribir)</option>
                      {partCatalog.map((c) => <option key={c.id} value={c.id}>{c.name}{c.brand ? ` • ${c.brand}` : ''}</option>)}
                    </Select>
                    {!part.partCatalogId ? (
                      <>
                        <Input value={part.name} onChange={(e) => setParts((prev) => prev.map((x) => x.key === part.key ? { ...x, name: e.target.value } : x))} placeholder="Nombre repuesto" />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Input value={part.brand} onChange={(e) => setParts((prev) => prev.map((x) => x.key === part.key ? { ...x, brand: e.target.value } : x))} placeholder="Marca" />
                          <Input value={part.sku} onChange={(e) => setParts((prev) => prev.map((x) => x.key === part.key ? { ...x, sku: e.target.value } : x))} placeholder="SKU" />
                        </div>
                      </>
                    ) : null}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Input value={part.qty} onChange={(e) => setParts((prev) => prev.map((x) => x.key === part.key ? { ...x, qty: e.target.value } : x))} placeholder="Cantidad" />
                      <Input value={part.unitPrice} onChange={(e) => setParts((prev) => prev.map((x) => x.key === part.key ? { ...x, unitPrice: e.target.value } : x))} placeholder="Precio unitario" />
                    </div>
                    <Input value={part.notes} onChange={(e) => setParts((prev) => prev.map((x) => x.key === part.key ? { ...x, notes: e.target.value } : x))} placeholder="Notas" />
                  </CardSection>
                </Card>
              ))}
            </>
          ) : null}

          {wizardStep === 5 ? (
            <>
              <div style={{ fontSize: 13 }}>Servicios: <b>{services.length}</b></div>
              <div style={{ fontSize: 13 }}>Repuestos: <b>{parts.length}</b></div>
              <div style={{ fontSize: 13 }}>Mano de obra: <b>{formatMoney(laborTotal)}</b></div>
              <div style={{ fontSize: 13 }}>Repuestos: <b>{formatMoney(partsTotal)}</b></div>
              <div style={{ fontSize: 15, fontWeight: 900 }}>Total: {formatMoney(grandTotal)}</div>
            </>
          ) : null}

          {wizardError ? <div style={{ color: '#FCA5A5', fontWeight: 700 }}>{wizardError}</div> : null}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <Button variant="outline" disabled={wizardStep === 1 || creatingBudget} onClick={() => setWizardStep((s) => Math.max(1, s - 1))}>Anterior</Button>
            {wizardStep < 5 ? (
              <Button onClick={() => {
                const e = validateStep(wizardStep)
                if (e) return setWizardError(e)
                setWizardError(null)
                setWizardStep((s) => Math.min(5, s + 1))
              }}>Siguiente</Button>
            ) : (
              <Button disabled={creatingBudget} onClick={async () => {
                const t = token
                if (!t) return
                const e = validateStep(2) || validateStep(3) || validateStep(4)
                if (e) return setWizardError(e)

                setCreatingBudget(true)
                setWizardError(null)
                try {
                  const serviceLines = [] as Array<{ description: string; qty: number; unitPrice: number }>
                  for (const s of services) {
                    let name = s.name.trim()
                    if (s.serviceCatalogId) {
                      const cat = serviceCatalog.find((c) => c.id === s.serviceCatalogId)
                      name = (cat?.name || name || '').trim()
                    } else if (name) {
                      const created = await createServiceCatalogInline(s)
                      name = created?.name || name
                    }
                    if (!name) throw new Error('Servicio sin nombre')
                    serviceLines.push({ description: `Servicio: ${name}`, qty: 1, unitPrice: Number(s.laborPrice) || 0 })
                  }

                  const partLines = [] as Array<{ description: string; qty: number; unitPrice: number }>
                  for (const pItem of parts) {
                    let name = pItem.name.trim()
                    if (pItem.partCatalogId) {
                      const cat = partCatalog.find((c) => c.id === pItem.partCatalogId)
                      name = (cat?.name || name || '').trim()
                    } else if (name) {
                      const created = await createPartCatalogInline(pItem)
                      name = created?.name || name
                    }
                    if (!name) throw new Error('Repuesto sin nombre')
                    partLines.push({ description: `Repuesto: ${name}`, qty: Number(pItem.qty) || 1, unitPrice: Number(pItem.unitPrice) || 0 })
                  }

                  const lines = [...serviceLines, ...partLines]
                  if (lines.length === 0) throw new Error('Agregá al menos un ítem válido.')

                  await api.budgets.create(t, {
                    customerId,
                    vehicleId,
                    intakeId: null,
                    status: 'PENDIENTE',
                    odometer: Number(odometer),
                    receivedAt: new Date(receivedAt).toISOString(),
                    budgetNotes: notes || null,
                    lines,
                  })
                  setWizardOpen(false)
                  await loadBudgets()
                } catch (err) {
                  setWizardError(err instanceof Error ? err.message : 'No se pudo crear el presupuesto')
                } finally {
                  setCreatingBudget(false)
                }
              }}>{creatingBudget ? 'Creando…' : 'Crear presupuesto'}</Button>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={!!detailBudget}
        title={
          detailBudget
            ? `Detalle ${detailBudget.vehicleId ? (vehicles.find((v) => v.id === detailBudget.vehicleId)?.plate || 'Sin placa') : 'Sin placa'} | ${surnameFromName(detailBudget.customerId ? customerNameById.get(detailBudget.customerId) || '' : '')} | ${formatDate(detailBudget.createdAt)}`
            : 'Detalle'
        }
        onClose={() => setDetailBudget(null)}
      >
        {detailBudget ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13 }}>Cliente: <b>{detailBudget.customerId ? customerNameById.get(detailBudget.customerId) || '—' : '—'}</b></div>
            <div style={{ fontSize: 13 }}>Vehículo: <b>{detailBudget.vehicleId ? vehicleLabelById.get(detailBudget.vehicleId) || '—' : '—'}</b></div>
            <div style={{ fontSize: 13 }}>Estado: <b>{detailBudget.status}</b></div>
            {(detailBudget.BudgetLines || []).map((line, idx) => (
              <Card key={`${line.description}-${idx}`} style={{ borderColor: p.cardBorder }}>
                <CardSection style={{ padding: 10 }}>
                  <div style={{ fontWeight: 700 }}>{line.description}</div>
                  <div style={{ fontSize: 14, opacity: 0.75 }}>Cant. {Number(line.qty) || 1} | Unit. {formatMoney(Number(line.unitPrice) || 0)} | Total {formatMoney(Number(line.lineTotal) || 0)}</div>
                </CardSection>
              </Card>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
              <Button variant="outline" onClick={() => setDetailBudget(null)}>Cerrar</Button>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigate('/app/pagos', {
                      state: paymentNavigateStateFromBudget(detailBudget),
                    })
                    setDetailBudget(null)
                  }}
                >
                  <Wallet size={14} /> Registrar pago
                </Button>
                <Button onClick={() => printBudget(detailBudget)}>PDF</Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
