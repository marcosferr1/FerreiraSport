import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, DollarSign, Wallet, CreditCard, Printer } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { Badge, Button, Card, CardSection, CircularProgress, Input, Modal, Select, Textarea } from '../components/inline/Primitives'
import { useAuth } from '../auth/useAuth'
import { api } from '../api/client'
import { usePalette } from '../theme/ThemeProvider'

type Payment = {
  id: string
  amount: string | number
  method: string
  paidAt: string
  intakeId?: string | null
  customerId?: string | null
  vehicleId?: string | null
  budgetId?: string | null
  note?: string | null
  reference?: string | null
}

type IntakeForSelect = {
  id: string
  customerId?: string | null
  vehicleId?: string | null
  status?: string
  receivedAt?: string
  odometer?: number | string | null
  laborTotal?: number | string | null
  partsTotal?: number | string | null
  total?: number | string | null
}

type PaymentPrefillState = {
  intakeId?: string
  customerId?: string | null
  vehicleId?: string | null
  suggestedAmount?: number | null
}

type MethodTab = 'TODOS' | 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'OTRO'

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

const BUSINESS_NAME = 'FERREIRA SPORT'
const BUSINESS_TAGLINE = 'Mecanica integral y diagnostico automotor'
const BUSINESS_EXPERIENCE = '35 años de experiencia'
const BUSINESS_SERVICES = 'Diagnostico electronico • Clonado de llaves • Mecanica integral'
const BUSINESS_OWNER = 'Santiago Ferreira'
const BUSINESS_PHONE = '3576 15414921'
const BUSINESS_EMAIL = 'santiagoferreira520@gmail.com'
const BUSINESS_ADDRESS = 'Rivadavia 1126, Arroyito, Cordoba, Argentina'

async function loadImageAsDataUrl(src: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('No se pudo procesar el logo para PDF.'))
        return
      }
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('No se pudo cargar el logo para PDF.'))
    img.src = src
  })
}

function drawBusinessFooter(doc: jsPDF) {
  const pageH = doc.internal.pageSize.getHeight()
  const pageW = doc.internal.pageSize.getWidth()
  const left = 14
  const right = pageW - 14
  const top = pageH - 27
  const middle = left + (right - left) * 0.58

  doc.setDrawColor(210, 214, 220)
  doc.line(left, top, right, top)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(26, 86, 219)
  doc.text(BUSINESS_NAME, left, top + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.8)
  doc.setTextColor(70, 70, 70)
  doc.text(BUSINESS_TAGLINE, left, top + 9.4)
  doc.text(BUSINESS_EXPERIENCE, left, top + 13.7)
  doc.text(BUSINESS_SERVICES, left, top + 18)

  doc.setFontSize(9)
  doc.setTextColor(30, 30, 30)
  doc.text(`${BUSINESS_OWNER} • Tel: ${BUSINESS_PHONE}`, middle, top + 5)
  doc.text(BUSINESS_EMAIL, middle, top + 9.4)
  doc.text(BUSINESS_ADDRESS, middle, top + 13.7)
}

async function downloadPaymentReceiptPdf(p: Payment, customerLabel: string, vehicleLabel: string) {
  const code = p.reference ? String(p.reference).trim() : `PAG-${shortId(p.id)}`
  const amount = toNumber(p.amount)
  const method = String(p.method || '—').trim()
  const budgetRef = p.budgetId ? shortId(p.budgetId) : '—'
  const note = (p.note && String(p.note).trim()) || '—'

  const rows: Array<[string, string]> = [
    ['Comprobante', code],
    ['Fecha y hora de cobro', formatDateTime(p.paidAt)],
    ['Cliente', customerLabel],
    ['Vehículo', vehicleLabel],
    ['Método de pago', method],
    ['Referencia', p.reference ? String(p.reference) : '—'],
    ['Presupuesto vinculado', budgetRef],
    ['Notas', note],
  ]

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  const usableW = pageW - margin * 2
  let y = 16

  try {
    const logoDataUrl = await loadImageAsDataUrl(`${window.location.origin}/logo-ferreira-sport.png`)
    doc.addImage(logoDataUrl, 'PNG', pageW - 58, 10, 44, 20)
  } catch {
    // Si falla el logo, no frenamos la exportación.
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text('Recibo de pago', margin, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90, 90, 90)
  doc.setFontSize(10.5)
  const subtitle = 'Resumen del cobro registrado en el sistema de taller (no constituye factura fiscal).'
  const subtitleLines = doc.splitTextToSize(subtitle, usableW - 48)
  doc.text(subtitleLines, margin, y)
  y += subtitleLines.length * 4.7 + 5

  doc.setTextColor(20, 20, 20)
  doc.setFontSize(10.5)
  rows.forEach(([label, value]) => {
    const cellY = y
    doc.setDrawColor(220)
    doc.rect(margin, cellY - 3.8, 62, 8.5)
    doc.rect(margin + 62, cellY - 3.8, usableW - 62, 8.5)
    doc.setFont('helvetica', 'bold')
    doc.text(label, margin + 2, cellY + 1.8)
    doc.setFont('helvetica', 'normal')
    const text = doc.splitTextToSize(value || '—', usableW - 66)
    doc.text(text, margin + 64, cellY + 1.8)
    y += Math.max(8.5, text.length * 4.4 + 3)
  })

  y += 4
  doc.setFillColor(249, 250, 251)
  doc.setDrawColor(229, 231, 235)
  doc.roundedRect(margin, y - 2, usableW, 12, 1.6, 1.6)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(`Total abonado: ${money(amount)}`, pageW - margin, y + 5.6, { align: 'right' })

  drawBusinessFooter(doc)
  doc.save(`Recibo-${code}.pdf`)
}


function shortId(id: string) {
  return id.length > 8 ? id.slice(0, 8).toUpperCase() : id.toUpperCase()
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
  const [page, setPage] = useState(1)
  const pageSize = 10
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

  const [intakeOptionsForModal, setIntakeOptionsForModal] = useState<IntakeForSelect[]>([])
  const [loadingIntakesModal, setLoadingIntakesModal] = useState(false)

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
    intakeId: '',
    customerId: '',
    vehicleId: '',
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
      Boolean(st.intakeId) ||
      Boolean(st.customerId) ||
      Boolean(st.vehicleId) ||
      (st.suggestedAmount != null && Number.isFinite(Number(st.suggestedAmount)))
    if (!has) return

    setPaymentForm((prev) => ({
      ...prev,
      intakeId: st.intakeId ?? prev.intakeId,
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
  const totalPages = Math.max(1, Math.ceil(rowsToShow.length / pageSize))
  const pagedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages)
    const from = (safePage - 1) * pageSize
    return rowsToShow.slice(from, from + pageSize)
  }, [rowsToShow, page, totalPages])

  useEffect(() => {
    setPage(1)
  }, [tab, listFilterCustomerId, listFilterFrom, listFilterTo, debouncedQ])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

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
    if (!cid) {
      setIntakeOptionsForModal([])
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingIntakesModal(true)
      try {
        const res = await api.intakes.list(token, { customerId: cid, vehicleId: vid || undefined })
        if (cancelled) return
        const list = (res.data || []) as IntakeForSelect[]
        setIntakeOptionsForModal(list)
        setPaymentForm((s) => {
          if (!s.intakeId) return s
          return list.some((x) => x.id === s.intakeId) ? s : { ...s, intakeId: '' }
        })
      } catch {
        if (!cancelled) setIntakeOptionsForModal([])
      } finally {
        if (!cancelled) setLoadingIntakesModal(false)
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
      intakeId: '',
      customerId: '',
      vehicleId: '',
      note: '',
      reference: '',
    })
    setIntakeOptionsForModal([])
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
          pagedRows.map((item) => {
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
                        onClick={async () => {
                          setReceiptPrintError(null)
                          const c = item.customerId ? customerNameById.get(item.customerId) || '—' : '—'
                          const v = item.vehicleId ? vehicleLabelById.get(item.vehicleId) || '—' : '—'
                          try {
                            await downloadPaymentReceiptPdf(item, c, v)
                          } catch (e) {
                            setReceiptPayment(item)
                            setReceiptPrintError(e instanceof Error ? e.message : 'No se pudo generar el PDF.')
                          }
                        }}
                      >
                        <Printer size={14} /> Recibo PDF
                      </Button>
                    </div>
                  </div>
                </CardSection>
              </Card>
            )
          })
        )}
      </div>
      {!showEmpty ? (
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, opacity: 0.72 }}>
            Página <b>{Math.min(page, totalPages)}</b> de <b>{totalPages}</b> · {rowsToShow.length} pagos
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}

      <Modal
        open={paymentModalOpen}
        title="Registrar Pago"
        onClose={() => {
          if (creatingPayment || creatingInlineCustomer || creatingInlineVehicle) return
          setPaymentModalOpen(false)
          setPaymentFormError(null)
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                    intakeId: '',
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
                      setPaymentForm((s) => ({ ...s, customerId: row.id, vehicleId: '', intakeId: '' }))
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
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Servicio (obligatorio)</div>
            {!paymentForm.customerId.trim() ? (
              <div style={{ fontSize: 13, opacity: 0.75 }}>Seleccioná cliente para ver sus servicios registrados.</div>
            ) : loadingIntakesModal ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CircularProgress size={18} />
                <div style={{ fontSize: 13, opacity: 0.75 }}>Cargando servicios…</div>
              </div>
            ) : intakeOptionsForModal.length === 0 ? (
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                No hay servicios para este cliente y vehículo. Creá uno en la sección Servicios.
              </div>
            ) : (
              <Select
                value={intakeOptionsForModal.some((x) => x.id === paymentForm.intakeId) ? paymentForm.intakeId : ''}
                onChange={(e) =>
                  setPaymentForm((s) => {
                    const intakeId = e.target.value
                    const selected = intakeOptionsForModal.find((x) => x.id === intakeId)
                    const nextVehicleId = selected?.vehicleId ? String(selected.vehicleId) : s.vehicleId
                    const totalNumber = Number(selected?.total)
                    return {
                      ...s,
                      intakeId,
                      vehicleId: nextVehicleId,
                      amount: Number.isFinite(totalNumber) ? String(totalNumber) : s.amount,
                    }
                  })
                }
              >
                <option value="">Seleccionar servicio</option>
                {intakeOptionsForModal.map((x) => {
                  const vehicle = vehicles.find((v) => v.id === x.vehicleId)
                  const modelo = [vehicle?.make, vehicle?.model].filter(Boolean).join(' ').trim() || 'Sin modelo'
                  const patente = vehicle?.plate || 'Sin patente'
                  const precio = money(Number(x.total) || 0)
                  return (
                    <option key={x.id} value={x.id}>
                      {`${modelo} - ${patente} - ${precio}`}
                    </option>
                  )
                })}
              </Select>
            )}
            {paymentForm.intakeId ? (
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.82 }}>
                Total sugerido del servicio aplicado al pago. Si necesitás, podés editar el monto manualmente.
              </div>
            ) : null}
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
                onChange={(e) => setPaymentForm((s) => ({ ...s, vehicleId: e.target.value, intakeId: '' }))}
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
                if (!paymentForm.intakeId.trim()) {
                  setPaymentFormError('Seleccioná el servicio (obligatorio) para generar el pago.')
                  return
                }
                setCreatingPayment(true)
                try {
                  await api.payments.create(t, {
                    amount,
                    method,
                    paidAt,
                    intakeId: paymentForm.intakeId.trim(),
                    customerId: paymentForm.customerId || null,
                    vehicleId: paymentForm.vehicleId || null,
                    budgetId: null,
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
              Comprobante de cobro interno del taller. Usá <b>Recibo PDF</b> para guardarlo o enviarlo.
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
                onClick={async () => {
                  setReceiptPrintError(null)
                  const c = receiptPayment.customerId ? customerNameById.get(receiptPayment.customerId) || '—' : '—'
                  const v = receiptPayment.vehicleId ? vehicleLabelById.get(receiptPayment.vehicleId) || '—' : '—'
                  try {
                    await downloadPaymentReceiptPdf(receiptPayment, c, v)
                  } catch (e) {
                    setReceiptPrintError(e instanceof Error ? e.message : 'No se pudo generar el PDF.')
                  }
                }}
              >
                <Printer size={16} /> Recibo PDF
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
