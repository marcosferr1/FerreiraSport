import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, DollarSign, Wallet, CreditCard, Printer } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Badge, Button, Card, CardSection, CircularProgress, Input, Modal, Select, Textarea } from '../components/inline/Primitives'
import { useAuth } from '../auth/useAuth'
import { api } from '../api/client'
import { usePalette } from '../theme/ThemeProvider'

type Payment = {
  id: string
  amount: string | number
  method: string
  paidAt: string
  customerId?: string | null
  vehicleId?: string | null
  budgetId?: string | null
  note?: string | null
  reference?: string | null
}

type PaymentPrefillState = {
  budgetId?: string
  customerId?: string | null
  vehicleId?: string | null
  suggestedAmount?: number | null
}

type MethodTab = 'TODOS' | 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'OTRO'

type BudgetForSelect = {
  id: string
  status?: string
  createdAt?: string
  total?: string | number
}

function money(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

function toNumber(v: unknown) {
  const n = typeof v === 'string' ? Number.parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}

function formatDate(value: unknown) {
  if (!value) return '—'
  const d = new Date(value as any)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('es-AR')
}

function formatDateTime(value: unknown) {
  if (!value) return '—'
  const d = new Date(value as any)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })
}

function sanitize(s: string) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function buildPaymentReceiptHtml(p: Payment, customerLabel: string, vehicleLabel: string) {
  const code = p.reference ? String(p.reference).trim() : `PAG-${shortId(p.id)}`
  const amount = toNumber(p.amount)
  const method = String(p.method || '—').trim()
  const budgetRef = p.budgetId ? shortId(p.budgetId) : '—'
  const note = (p.note && String(p.note).trim()) || '—'

  const rows = [
    ['Comprobante', sanitize(code)],
    ['Fecha y hora de cobro', sanitize(formatDateTime(p.paidAt))],
    ['Cliente', sanitize(customerLabel)],
    ['Vehículo', sanitize(vehicleLabel)],
    ['Método de pago', sanitize(method)],
    ['Referencia', p.reference ? sanitize(String(p.reference)) : '—'],
    ['Presupuesto vinculado', budgetRef === '—' ? '—' : sanitize(budgetRef)],
    ['Notas', note === '—' ? '—' : sanitize(note)],
  ]
    .map(([k, v]) => `<tr><th>${sanitize(String(k))}</th><td>${v}</td></tr>`)
    .join('')

  const logoUrl = `${window.location.origin}/ferreira-logo.png`
  return `<!doctype html><html><head><meta charset="utf-8" /><title>Recibo ${sanitize(code)}</title><style>
body{font-family:Arial,Helvetica,sans-serif;padding:24px;max-width:760px;margin:0 auto;color:#111}
.head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:10px}
.logo{width:200px;max-width:40vw;object-fit:contain}
h1{margin:0 0 6px;font-size:22px}
.sub{color:#555;font-size:13px;margin-bottom:18px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{border:1px solid #ddd;padding:10px 12px;text-align:left;vertical-align:top}
th{background:#f3f4f6;width:38%;font-weight:700}
.total{margin-top:22px;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;font-size:18px;font-weight:700;text-align:right}
.foot{color:#6b7280;font-size:11px;margin-top:20px}
</style></head><body>
<div class="head"><div><h1>Recibo de pago</h1><div class="sub">Resumen del cobro registrado en el sistema de taller (no constituye factura fiscal).</div></div><img src="${logoUrl}" class="logo" alt="FERREIRA SPORT" /></div>
<table><tbody>${rows}</tbody></table>
<div class="total">Total abonado: ${sanitize(money(amount))}</div>
<p class="foot">ID interno: ${sanitize(p.id)}</p>
</body></html>`
}

function printPaymentReceiptHtml(html: string) {
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
    return false
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
  return true
}

function shortId(id: string) {
  return id.length > 8 ? id.slice(0, 8).toUpperCase() : id.toUpperCase()
}

function formatBudgetOptionLabel(b: BudgetForSelect) {
  const total = b.total == null ? 0 : Number(b.total)
  const mt = Number.isFinite(total) ? total : 0
  const st = b.status ?? '—'
  return `${shortId(b.id)} · ${formatDate(b.createdAt)} · ${st} · ${money(mt)}`
}

function normalizeMethod(method: string) {
  return method?.trim().toUpperCase()
}

function methodTone(method: string): 'neutral' | 'success' | 'danger' | 'warning' {
  const m = normalizeMethod(method)
  if (m === 'EFECTIVO') return 'success'
  if (m === 'TARJETA') return 'warning'
  if (m === 'TRANSFERENCIA') return 'neutral'
  return 'danger'
}

function methodTabLabel(tab: MethodTab) {
  switch (tab) {
    case 'EFECTIVO':
      return 'Efectivo'
    case 'TARJETA':
      return 'Tarjeta'
    case 'TRANSFERENCIA':
      return 'Transferencia'
    case 'OTRO':
      return 'Otro'
    default:
      return 'Todos'
  }
}

function segmentBtnStyle(active: boolean) {
  return {
    flex: 1,
    minWidth: 100,
    height: 34,
    borderRadius: 10,
    border: '1px solid rgba(15,23,42,0.15)',
    background: active ? '#2563EB' : 'transparent',
    color: active ? '#fff' : 'inherit',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer' as const,
  }
}

export default function PaymentsPage() {
  const p = usePalette()
  const { token } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [searchInput, setSearchInput] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(searchInput.trim()), 350)
    return () => window.clearTimeout(id)
  }, [searchInput])

  const [tab, setTab] = useState<MethodTab>('TODOS')
  const [listFilterCustomerId, setListFilterCustomerId] = useState('')
  const [listFilterFrom, setListFilterFrom] = useState('')
  const [listFilterTo, setListFilterTo] = useState('')

  const [loadingLookups, setLoadingLookups] = useState(true)
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentsError, setPaymentsError] = useState<string | null>(null)

  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null)
  const [receiptPrintError, setReceiptPrintError] = useState<string | null>(null)
  const [creatingPayment, setCreatingPayment] = useState(false)
  const [paymentFormError, setPaymentFormError] = useState<string | null>(null)

  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing')
  const [vehicleMode, setVehicleMode] = useState<'existing' | 'new'>('existing')
  const [creatingInlineCustomer, setCreatingInlineCustomer] = useState(false)
  const [creatingInlineVehicle, setCreatingInlineVehicle] = useState(false)

  const [budgetOptionsForModal, setBudgetOptionsForModal] = useState<BudgetForSelect[]>([])
  const [loadingBudgetsModal, setLoadingBudgetsModal] = useState(false)

  const [newCustomer, setNewCustomer] = useState({
    type: 'PARTICULAR',
    name: '',
    phone: '',
    email: '',
    doc: '',
  })
  const [newVehicle, setNewVehicle] = useState({
    plate: '',
    make: '',
    model: '',
    year: '',
  })

  const [paymentForm, setPaymentForm] = useState({
    method: 'EFECTIVO',
    amount: '',
    paidAt: new Date().toISOString().slice(0, 10),
    customerId: '',
    vehicleId: '',
    budgetId: '',
    note: '',
    reference: '',
  })

  const [payments, setPayments] = useState<Payment[]>([])
  const [customers, setCustomers] = useState<Array<{ id: string; name?: string | null }>>([])
  const [vehicles, setVehicles] = useState<
    Array<{ id: string; plate: string; make?: string | null; model?: string | null; year?: number | null; customerId?: string | null }>
  >([])

  useEffect(() => {
    const t = token
    if (!t) return
    let cancelled = false

    async function load() {
      setLoadingLookups(true)
      setError(null)
      try {
        const [customersRes, vehiclesRes] = await Promise.all([api.customers.list(t!), api.vehicles.list(t!)])
        if (cancelled) return
        setCustomers(customersRes.data || [])
        setVehicles(vehiclesRes.data || [])
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Error al cargar datos')
      } finally {
        if (cancelled) return
        setLoadingLookups(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [token])

  const fetchPayments = useCallback(async () => {
    const t = token
    if (!t) return
    setLoadingPayments(true)
    setPaymentsError(null)
    try {
      const method = tab === 'TODOS' || tab === 'OTRO' ? undefined : tab
      const res = await api.payments.list(t, {
        from: listFilterFrom || undefined,
        to: listFilterTo || undefined,
        customerId: listFilterCustomerId || undefined,
        method,
        q: debouncedQ || undefined,
      })
      setPayments(res.data || [])
    } catch (e) {
      setPaymentsError(e instanceof Error ? e.message : 'Error al cargar pagos')
      setPayments([])
    } finally {
      setLoadingPayments(false)
    }
  }, [token, tab, listFilterFrom, listFilterTo, listFilterCustomerId, debouncedQ])

  useEffect(() => {
    if (!token || loadingLookups) return
    fetchPayments()
  }, [token, loadingLookups, fetchPayments])

  useEffect(() => {
    const st = location.state as PaymentPrefillState | null | undefined
    if (!st || typeof st !== 'object') return
    const has =
      Boolean(st.budgetId) ||
      Boolean(st.customerId) ||
      Boolean(st.vehicleId) ||
      (st.suggestedAmount != null && Number.isFinite(Number(st.suggestedAmount)))
    if (!has) return

    setPaymentForm((prev) => ({
      ...prev,
      budgetId: st.budgetId ?? prev.budgetId,
      customerId: st.customerId ? String(st.customerId) : prev.customerId,
      vehicleId: st.vehicleId ? String(st.vehicleId) : prev.vehicleId,
      amount:
        st.suggestedAmount != null && Number.isFinite(Number(st.suggestedAmount)) ? String(st.suggestedAmount) : prev.amount,
    }))
    setCustomerMode('existing')
    setVehicleMode('existing')
    setPaymentFormError(null)
    setPaymentModalOpen(true)
    navigate(`${location.pathname}${location.search}`, { replace: true, state: {} })
  }, [location.state, location.pathname, location.search, navigate])

  const reloadLookups = useCallback(async () => {
    const t = token
    if (!t) return
    const [customersRes, vehiclesRes] = await Promise.all([api.customers.list(t), api.vehicles.list(t)])
    setCustomers(customersRes.data || [])
    setVehicles(vehiclesRes.data || [])
  }, [token])

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of customers) map.set(c.id, c.name || '')
    return map
  }, [customers])

  const vehicleLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of vehicles) {
      const parts = [v.plate, v.make, v.model].filter(Boolean).map((x) => String(x).trim())
      const base = parts.join(' ')
      map.set(v.id, base || v.id)
    }
    return map
  }, [vehicles])

  const filtered = useMemo(() => {
    const known = new Set(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'])
    return payments.filter((pmt) => {
      const m = normalizeMethod(pmt.method)
      if (tab === 'TODOS') return true
      if (tab === 'OTRO') return !known.has(m)
      return m === tab
    })
  }, [payments, tab])

  const qForLocal = debouncedQ.trim().toLowerCase()
  const rowsToShow = useMemo(() => {
    if (!qForLocal) return filtered
    return filtered.filter((pmt) => {
      const code = (pmt.reference || shortId(pmt.id)).toLowerCase()
      const customer = pmt.customerId ? (customerNameById.get(pmt.customerId) || '').toLowerCase() : ''
      const vehicle = pmt.vehicleId ? (vehicleLabelById.get(pmt.vehicleId) || '').toLowerCase() : ''
      const method = (pmt.method || '').toLowerCase()
      const note = (pmt.note || '').toLowerCase()
      return [code, customer, vehicle, method, note].some((x) => x.includes(qForLocal))
    })
  }, [filtered, qForLocal, customerNameById, vehicleLabelById])

  const totalCollected = useMemo(() => rowsToShow.reduce((acc, pmt) => acc + toNumber(pmt.amount), 0), [rowsToShow])
  const txCount = rowsToShow.length
  const paymentsWithBudget = useMemo(() => rowsToShow.filter((pmt) => Boolean(pmt.budgetId)).length, [rowsToShow])

  const vehiclesForModal = useMemo(() => {
    if (!paymentForm.customerId) return vehicles
    return vehicles.filter((v) => v.customerId === paymentForm.customerId)
  }, [vehicles, paymentForm.customerId])

  useEffect(() => {
    if (!token || !paymentModalOpen) return
    const cid = paymentForm.customerId.trim()
    const vid = paymentForm.vehicleId.trim()
    if (!cid || !vid) {
      setBudgetOptionsForModal([])
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingBudgetsModal(true)
      try {
        const res = await api.budgets.list(token, { customerId: cid, vehicleId: vid })
        if (cancelled) return
        const list = (res.data || []) as BudgetForSelect[]
        setBudgetOptionsForModal(list)
        setPaymentForm((s) => {
          if (!s.budgetId) return s
          return list.some((b) => b.id === s.budgetId) ? s : { ...s, budgetId: '' }
        })
      } catch {
        if (!cancelled) setBudgetOptionsForModal([])
      } finally {
        if (!cancelled) setLoadingBudgetsModal(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, paymentModalOpen, paymentForm.customerId, paymentForm.vehicleId])

  function openNewPaymentModal() {
    setPaymentFormError(null)
    setCustomerMode('existing')
    setVehicleMode('existing')
    setNewCustomer({ type: 'PARTICULAR', name: '', phone: '', email: '', doc: '' })
    setNewVehicle({ plate: '', make: '', model: '', year: '' })
    setPaymentForm({
      method: 'EFECTIVO',
      amount: '',
      paidAt: new Date().toISOString().slice(0, 10),
      customerId: '',
      vehicleId: '',
      budgetId: '',
      note: '',
      reference: '',
    })
    setPaymentModalOpen(true)
  }

  if (loadingLookups) {
    return (
      <div>
        <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900 }}>Pagos</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Gestión de los pagos y cobros</div>
          </div>
          <Button disabled>+ Registrar Pago</Button>
        </div>
        <Card style={{ borderColor: p.cardBorder }}>
          <CardSection style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CircularProgress size={24} />
              <div style={{ fontWeight: 900 }}>Cargando…</div>
            </div>
          </CardSection>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900 }}>Pagos</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Gestión de los pagos y cobros</div>
          </div>
          <Button disabled>+ Registrar Pago</Button>
        </div>
        <Card style={{ borderColor: 'rgba(239,68,68,0.35)' }}>
          <CardSection style={{ padding: 18 }}>
            <div style={{ fontWeight: 900, marginBottom: 6, color: '#FCA5A5' }}>No se pudo cargar</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>{error}</div>
          </CardSection>
        </Card>
      </div>
    )
  }

  const showEmpty = !loadingPayments && rowsToShow.length === 0

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>Pagos</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Gestión de los pagos y cobros</div>
          {loadingPayments ? (
            <div style={{ fontSize: 14, opacity: 0.65, marginTop: 6 }}>Actualizando listado…</div>
          ) : null}
        </div>
        <Button onClick={openNewPaymentModal}>+ Registrar Pago</Button>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: 16 }}>
        <Card>
          <CardSection style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <DollarSign size={18} />
              <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.8 }}>Total Recaudado</div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 950, marginTop: 10 }}>{totalCollected > 0 ? money(totalCollected) : '—'}</div>
            <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>Según filtros y método</div>
          </CardSection>
        </Card>

        <Card>
          <CardSection style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Wallet size={18} />
              <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.8 }}>Transacciones</div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 950, marginTop: 10 }}>{txCount > 0 ? txCount : '—'}</div>
            <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>En el resultado actual</div>
          </CardSection>
        </Card>

        <Card>
          <CardSection style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CreditCard size={18} />
              <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.8 }}>Con presupuesto</div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 950, marginTop: 10 }}>{paymentsWithBudget > 0 ? paymentsWithBudget : '—'}</div>
            <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>Pagos asociados</div>
          </CardSection>
        </Card>
      </div>

      <Card style={{ borderColor: p.cardBorder, marginBottom: 16 }}>
        <CardSection style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>Filtros del listado</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 700, opacity: 0.85 }}>Cliente</label>
              <Select value={listFilterCustomerId} onChange={(e) => setListFilterCustomerId(e.target.value)}>
                <option value="">Todos los clientes</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.id}
                  </option>
                ))}
              </Select>
            </div>
            <div style={{ flex: '0 1 160px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 700, opacity: 0.85 }}>Desde</label>
              <Input type="date" value={listFilterFrom} onChange={(e) => setListFilterFrom(e.target.value)} />
            </div>
            <div style={{ flex: '0 1 160px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 700, opacity: 0.85 }}>Hasta</label>
              <Input type="date" value={listFilterTo} onChange={(e) => setListFilterTo(e.target.value)} />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setListFilterCustomerId('')
                setListFilterFrom('')
                setListFilterTo('')
              }}
            >
              Limpiar fechas y cliente
            </Button>
          </div>
        </CardSection>
      </Card>

      {paymentsError ? (
        <Card style={{ borderColor: 'rgba(239,68,68,0.35)', marginBottom: 14 }}>
          <CardSection style={{ padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#FCA5A5' }}>{paymentsError}</div>
          </CardSection>
        </Card>
      ) : null}

      <div style={{ marginBottom: 14 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.7 }}>
            <Search size={16} />
          </div>
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar (referencia, nota; también filtra en pantalla por cliente/vehículo)"
            style={{ paddingLeft: 40 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {(['TODOS', 'EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
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
            {methodTabLabel(t)}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {showEmpty ? (
          <Card>
            <CardSection style={{ padding: 18 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Sin pagos en este criterio</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>Ajustá filtros, fechas o registrá un pago nuevo.</div>
            </CardSection>
          </Card>
        ) : (
          rowsToShow.map((item) => {
            const code = item.reference ? item.reference : `PAG-${shortId(item.id)}`
            const customer = item.customerId ? customerNameById.get(item.customerId) || '—' : '—'
            const vehicle = item.vehicleId ? vehicleLabelById.get(item.vehicleId) || '—' : '—'
            const budget = item.budgetId ? shortId(item.budgetId) : null
            const amount = toNumber(item.amount)

            return (
              <Card key={item.id}>
                <CardSection style={{ padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 16,
                          background: 'rgba(37,99,235,0.10)',
                          border: '1px solid rgba(37,99,235,0.18)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CreditCard size={20} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 16, fontWeight: 950 }}>{code}</div>
                          <Badge label={item.method} tone={methodTone(item.method) as any} />
                        </div>
                        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>{customer !== '—' ? `Cliente: ${customer}` : 'Sin cliente'}</div>
                        <div style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>Vehículo: {vehicle}</div>
                        {budget ? (
                          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.75 }}>
                            Presupuesto: <b style={{ opacity: 0.95 }}>{budget}</b>
                          </div>
                        ) : null}
                        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
                          {formatDate(item.paidAt)} &nbsp;|&nbsp; <b style={{ opacity: 0.95 }}>{money(amount)}</b>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
                      <Button variant="outline" size="sm" onClick={() => setReceiptPayment(item)}>
                        Ver recibo
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setReceiptPrintError(null)
                          const c = item.customerId ? customerNameById.get(item.customerId) || '—' : '—'
                          const v = item.vehicleId ? vehicleLabelById.get(item.vehicleId) || '—' : '—'
                          const html = buildPaymentReceiptHtml(item, c, v)
                          if (!printPaymentReceiptHtml(html)) {
                            setReceiptPayment(item)
                            setReceiptPrintError('No se pudo abrir el diálogo de impresión.')
                          }
                        }}
                      >
                        <Printer size={14} /> PDF
                      </Button>
                    </div>
                  </div>
                </CardSection>
              </Card>
            )
          })
        )}
      </div>

      <Modal
        open={paymentModalOpen}
        title="Registrar Pago"
        onClose={() => {
          if (creatingPayment || creatingInlineCustomer || creatingInlineVehicle) return
          setPaymentModalOpen(false)
          setPaymentFormError(null)
          setBudgetOptionsForModal([])
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {paymentForm.budgetId ? (
            <div
              style={{
                fontSize: 13,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(37,99,235,0.25)',
                background: 'rgba(37,99,235,0.08)',
              }}
            >
              Vinculado a presupuesto <b>{shortId(paymentForm.budgetId)}</b>. Podés editar cualquier campo antes de guardar.
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Método</label>
              <Select value={paymentForm.method} onChange={(e) => setPaymentForm((s) => ({ ...s, method: e.target.value }))}>
                <option value="EFECTIVO">EFECTIVO</option>
                <option value="TARJETA">TARJETA</option>
                <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                <option value="OTRO">OTRO</option>
              </Select>
            </div>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Fecha (paidAt)</label>
              <Input type="date" value={paymentForm.paidAt} onChange={(e) => setPaymentForm((s) => ({ ...s, paidAt: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Monto (ARS). Se permite 0</label>
            <Input
              type="number"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm((s) => ({ ...s, amount: e.target.value }))}
              placeholder="0"
              step="0.01"
              min={0}
            />
            <div style={{ fontSize: 14, opacity: 0.7 }}>Vacío o 0 sirve para reservas, ajustes o cobros simbólicos.</div>
          </div>

          <div style={{ borderTop: `1px solid ${p.cardBorder}`, paddingTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Cliente</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button type="button" style={segmentBtnStyle(customerMode === 'existing')} onClick={() => setCustomerMode('existing')}>
                Existente
              </button>
              <button type="button" style={segmentBtnStyle(customerMode === 'new')} onClick={() => setCustomerMode('new')}>
                Nuevo
              </button>
            </div>
            {customerMode === 'existing' ? (
              <Select
                value={paymentForm.customerId}
                onChange={(e) =>
                  setPaymentForm((s) => ({
                    ...s,
                    customerId: e.target.value,
                    vehicleId: '',
                    budgetId: '',
                  }))
                }
              >
                <option value="">Sin cliente</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || 'Cliente'}
                  </option>
                ))}
              </Select>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Input
                  placeholder="Nombre *"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer((s) => ({ ...s, name: e.target.value }))}
                />
                <Input
                  placeholder="Tipo (opcional), ej. PARTICULAR"
                  value={newCustomer.type}
                  onChange={(e) => setNewCustomer((s) => ({ ...s, type: e.target.value }))}
                />
                <Input placeholder="Teléfono" value={newCustomer.phone} onChange={(e) => setNewCustomer((s) => ({ ...s, phone: e.target.value }))} />
                <Input placeholder="Email" value={newCustomer.email} onChange={(e) => setNewCustomer((s) => ({ ...s, email: e.target.value }))} />
                <Input placeholder="Doc" value={newCustomer.doc} onChange={(e) => setNewCustomer((s) => ({ ...s, doc: e.target.value }))} />
                <Button
                  variant="outline"
                  disabled={creatingInlineCustomer || !token}
                  onClick={async () => {
                    const t = token
                    if (!t) return
                    const name = newCustomer.name.trim()
                    if (!name) {
                      setPaymentFormError('El nombre del cliente es obligatorio.')
                      return
                    }
                    setPaymentFormError(null)
                    setCreatingInlineCustomer(true)
                    try {
                      const res = await api.customers.create(t, {
                        name,
                        type: newCustomer.type.trim() || null,
                        phone: newCustomer.phone.trim() || null,
                        email: newCustomer.email.trim() || null,
                        doc: newCustomer.doc.trim() || null,
                      })
                      const row = res.data as { id: string; name?: string | null }
                      if (!row?.id) throw new Error('Respuesta sin id de cliente')
                      setCustomers((prev) => [...prev, row])
                      setPaymentForm((s) => ({ ...s, customerId: row.id, vehicleId: '', budgetId: '' }))
                      setCustomerMode('existing')
                      setNewCustomer({ type: 'PARTICULAR', name: '', phone: '', email: '', doc: '' })
                    } catch (e) {
                      setPaymentFormError(e instanceof Error ? e.message : 'No se pudo crear el cliente')
                    } finally {
                      setCreatingInlineCustomer(false)
                    }
                  }}
                >
                  {creatingInlineCustomer ? 'Creando cliente…' : 'Crear cliente y usar'}
                </Button>
              </div>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${p.cardBorder}`, paddingTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Vehículo</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button
                type="button"
                style={segmentBtnStyle(vehicleMode === 'existing')}
                onClick={() => setVehicleMode('existing')}
              >
                Existente
              </button>
              <button type="button" style={segmentBtnStyle(vehicleMode === 'new')} onClick={() => setVehicleMode('new')}>
                Nuevo
              </button>
            </div>
            {vehicleMode === 'existing' ? (
              <Select
                value={paymentForm.vehicleId}
                onChange={(e) => setPaymentForm((s) => ({ ...s, vehicleId: e.target.value, budgetId: '' }))}
              >
                <option value="">Sin vehículo</option>
                {vehiclesForModal.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                  </option>
                ))}
              </Select>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {!paymentForm.customerId ? (
                  <div style={{ fontSize: 13, color: '#FCA5A5', fontWeight: 700 }}>Primero seleccioná o creá un cliente para asociar el vehículo.</div>
                ) : null}
                <Input
                  placeholder="Patente / matrícula *"
                  value={newVehicle.plate}
                  onChange={(e) => setNewVehicle((s) => ({ ...s, plate: e.target.value }))}
                />
                <Input placeholder="Marca" value={newVehicle.make} onChange={(e) => setNewVehicle((s) => ({ ...s, make: e.target.value }))} />
                <Input placeholder="Modelo" value={newVehicle.model} onChange={(e) => setNewVehicle((s) => ({ ...s, model: e.target.value }))} />
                <Input
                  type="number"
                  placeholder="Año"
                  value={newVehicle.year}
                  onChange={(e) => setNewVehicle((s) => ({ ...s, year: e.target.value }))}
                />
                <Button
                  variant="outline"
                  disabled={creatingInlineVehicle || !token || !paymentForm.customerId}
                  onClick={async () => {
                    const t = token
                    if (!t) return
                    const cid = paymentForm.customerId.trim()
                    if (!cid) {
                      setPaymentFormError('Seleccioná o creá un cliente antes del vehículo.')
                      return
                    }
                    const plate = newVehicle.plate.trim()
                    if (!plate) {
                      setPaymentFormError('La patente es obligatoria.')
                      return
                    }
                    setPaymentFormError(null)
                    setCreatingInlineVehicle(true)
                    try {
                      const yearNum = newVehicle.year.trim() ? Number(newVehicle.year) : null
                      const res = await api.vehicles.create(t, {
                        plate,
                        make: newVehicle.make.trim() || null,
                        model: newVehicle.model.trim() || null,
                        year: Number.isFinite(yearNum) ? yearNum : null,
                        customerId: cid,
                      })
                      const row = res.data as { id: string; plate: string; customerId?: string | null; make?: string | null; model?: string | null }
                      if (!row?.id) throw new Error('Respuesta sin id de vehículo')
                      setVehicles((prev) => [...prev, row])
                      setPaymentForm((s) => ({ ...s, vehicleId: row.id }))
                      setVehicleMode('existing')
                      setNewVehicle({ plate: '', make: '', model: '', year: '' })
                    } catch (e) {
                      setPaymentFormError(e instanceof Error ? e.message : 'No se pudo crear el vehículo')
                    } finally {
                      setCreatingInlineVehicle(false)
                    }
                  }}
                >
                  {creatingInlineVehicle ? 'Creando vehículo…' : 'Crear vehículo y usar'}
                </Button>
              </div>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${p.cardBorder}`, paddingTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Presupuesto (opcional)</div>
            {!paymentForm.customerId.trim() || !paymentForm.vehicleId.trim() ? (
              <div style={{ fontSize: 13, opacity: 0.75 }}>Seleccioná cliente y vehículo para ver los presupuestos de ese par.</div>
            ) : loadingBudgetsModal ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CircularProgress size={18} />
                <div style={{ fontSize: 13, opacity: 0.75 }}>Cargando presupuestos…</div>
              </div>
            ) : budgetOptionsForModal.length === 0 ? (
              <div style={{ fontSize: 13, opacity: 0.75 }}>No hay presupuestos cargados para este cliente y este vehículo.</div>
            ) : (
              <Select
                value={budgetOptionsForModal.some((b) => b.id === paymentForm.budgetId) ? paymentForm.budgetId : ''}
                onChange={(e) => {
                  const id = e.target.value
                  setPaymentForm((s) => {
                    const sel = budgetOptionsForModal.find((x) => x.id === id)
                    const next = { ...s, budgetId: id }
                    if (sel && (s.amount.trim() === '' || Number(s.amount) === 0)) {
                      const t = sel.total == null ? 0 : Number(sel.total)
                      if (Number.isFinite(t)) next.amount = String(t)
                    }
                    return next
                  })
                }}
              >
                <option value="">Sin presupuesto</option>
                {budgetOptionsForModal.map((b) => (
                  <option key={b.id} value={b.id}>
                    {formatBudgetOptionLabel(b)}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Referencia (opcional)</label>
              <Input value={paymentForm.reference} onChange={(e) => setPaymentForm((s) => ({ ...s, reference: e.target.value }))} placeholder="Ej: #PAG-..." />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Nota (opcional)</label>
            <Textarea value={paymentForm.note} onChange={(e) => setPaymentForm((s) => ({ ...s, note: e.target.value }))} placeholder="Observaciones" />
          </div>

          {paymentFormError ? (
            <div
              style={{
                borderRadius: 12,
                border: '1px solid rgba(239, 68, 68, 0.35)',
                background: 'rgba(239, 68, 68, 0.12)',
                padding: '10px 12px',
                fontSize: 13,
                color: '#FCA5A5',
                fontWeight: 700,
              }}
            >
              {paymentFormError}
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
            <Button
              variant="outline"
              disabled={creatingPayment || creatingInlineCustomer || creatingInlineVehicle}
              onClick={() => {
                if (creatingPayment) return
                setPaymentModalOpen(false)
                setPaymentFormError(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={creatingPayment || creatingInlineCustomer || creatingInlineVehicle}
              onClick={async () => {
                const t = token
                if (!t) return

                setPaymentFormError(null)

                const method = paymentForm.method.trim()
                const paidAt = paymentForm.paidAt
                const amountRaw = paymentForm.amount.trim()
                const amount = amountRaw === '' ? 0 : Number(amountRaw)

                if (!method || !paidAt) {
                  setPaymentFormError('Completá método y fecha.')
                  return
                }
                if (!Number.isFinite(amount) || amount < 0) {
                  setPaymentFormError('El monto debe ser un número mayor o igual a 0.')
                  return
                }

                setCreatingPayment(true)
                try {
                  await api.payments.create(t, {
                    amount,
                    method,
                    paidAt,
                    customerId: paymentForm.customerId || null,
                    vehicleId: paymentForm.vehicleId || null,
                    intakeId: null,
                    budgetId: paymentForm.budgetId.trim() || null,
                    note: paymentForm.note.trim() || null,
                    reference: paymentForm.reference.trim() || null,
                  })

                  await fetchPayments()
                  await reloadLookups()

                  setPaymentModalOpen(false)
                } catch (e) {
                  setPaymentFormError(e instanceof Error ? e.message : 'Error al crear pago')
                } finally {
                  setCreatingPayment(false)
                }
              }}
            >
              {creatingPayment ? 'Creando…' : 'Crear Pago'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(receiptPayment)}
        title={
          receiptPayment
            ? receiptPayment.reference?.trim()
              ? receiptPayment.reference
              : `Recibo ${shortId(receiptPayment.id)}`
            : 'Recibo'
        }
        onClose={() => {
          setReceiptPayment(null)
          setReceiptPrintError(null)
        }}
      >
        {receiptPayment ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.45 }}>
              Comprobante de cobro interno del taller. Usá <b>Imprimir PDF</b> para guardarlo o enviarlo (el navegador permite “Guardar como PDF”).
            </div>
            <div
              style={{
                borderRadius: 12,
                border: `1px solid ${p.cardBorder}`,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                fontSize: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 14, opacity: 0.7, fontWeight: 700 }}>Fecha y hora</div>
                <div style={{ fontWeight: 800 }}>{formatDateTime(receiptPayment.paidAt)}</div>
              </div>
              <div>
                <div style={{ fontSize: 14, opacity: 0.7, fontWeight: 700 }}>Cliente</div>
                <div>{receiptPayment.customerId ? customerNameById.get(receiptPayment.customerId) || '—' : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 14, opacity: 0.7, fontWeight: 700 }}>Vehículo</div>
                <div>{receiptPayment.vehicleId ? vehicleLabelById.get(receiptPayment.vehicleId) || '—' : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 14, opacity: 0.7, fontWeight: 700 }}>Método</div>
                <div>{receiptPayment.method}</div>
              </div>
              {receiptPayment.budgetId ? (
                <div>
                  <div style={{ fontSize: 14, opacity: 0.7, fontWeight: 700 }}>Presupuesto</div>
                  <div>{shortId(receiptPayment.budgetId)}</div>
                </div>
              ) : null}
              {receiptPayment.reference ? (
                <div>
                  <div style={{ fontSize: 14, opacity: 0.7, fontWeight: 700 }}>Referencia</div>
                  <div>{receiptPayment.reference}</div>
                </div>
              ) : null}
              {receiptPayment.note ? (
                <div>
                  <div style={{ fontSize: 14, opacity: 0.7, fontWeight: 700 }}>Notas</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{receiptPayment.note}</div>
                </div>
              ) : null}
              <div
                style={{
                  marginTop: 6,
                  paddingTop: 12,
                  borderTop: `1px solid ${p.cardBorder}`,
                  fontSize: 20,
                  fontWeight: 950,
                  textAlign: 'right',
                }}
              >
                {money(toNumber(receiptPayment.amount))}
              </div>
              <div style={{ fontSize: 11, opacity: 0.55 }}>ID: {receiptPayment.id}</div>
            </div>

            {receiptPrintError ? (
              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  background: 'rgba(239, 68, 68, 0.12)',
                  padding: '10px 12px',
                  fontSize: 13,
                  color: '#FCA5A5',
                  fontWeight: 700,
                }}
              >
                {receiptPrintError}
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setReceiptPayment(null)
                  setReceiptPrintError(null)
                }}
              >
                Cerrar
              </Button>
              <Button
                onClick={() => {
                  setReceiptPrintError(null)
                  const c = receiptPayment.customerId ? customerNameById.get(receiptPayment.customerId) || '—' : '—'
                  const v = receiptPayment.vehicleId ? vehicleLabelById.get(receiptPayment.vehicleId) || '—' : '—'
                  const html = buildPaymentReceiptHtml(receiptPayment, c, v)
                  if (!printPaymentReceiptHtml(html)) setReceiptPrintError('No se pudo abrir la impresión.')
                }}
              >
                <Printer size={16} /> Imprimir PDF
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
