import React, { useEffect, useMemo, useState } from 'react'
import { Wrench, Plus, Trash2 } from 'lucide-react'
import { Button, Card, CardSection, CircularProgress, Input, Select, Textarea } from '../components/inline/Primitives'
import { useAuth } from '../auth/useAuth'
import { api } from '../api/client'
import { usePalette } from '../theme/ThemeProvider'
import { useLocation, useNavigate } from 'react-router-dom'

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

export default function ServiceWizardPage() {
  const p = usePalette()
  const { token } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [customers, setCustomers] = useState<Array<{ id: string; name?: string | null }>>([])
  const [vehicles, setVehicles] = useState<Array<{ id: string; plate: string; make?: string | null; model?: string | null; customerId?: string | null }>>([])
  const [serviceCatalog, setServiceCatalog] = useState<Array<{ id: string; name: string; suggestedPrice?: number | string | null }>>([])
  const [partCatalog, setPartCatalog] = useState<Array<{ id: string; name: string; brand?: string | null; sku?: string | null; suggestedPrice?: number | string | null }>>([])

  const [customerId, setCustomerId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [odometer, setOdometer] = useState('')
  const [receivedAt, setReceivedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [intakeNotes, setIntakeNotes] = useState('')

  const [services, setServices] = useState<ServiceItem[]>([])
  const [parts, setParts] = useState<PartItem[]>([])
  const [prefillApplied, setPrefillApplied] = useState(false)
  const [lastVehicleOdometer, setLastVehicleOdometer] = useState<number | null>(null)

  const vehiclesForCustomer = useMemo(
    () => vehicles.filter((v) => (customerId ? v.customerId === customerId : true)),
    [vehicles, customerId]
  )
  const selectedCustomerHasVehicles = customerId ? vehiclesForCustomer.length > 0 : true

  const laborTotal = useMemo(() => services.reduce((acc, s) => acc + (Number(s.laborPrice) || 0), 0), [services])
  const partsTotal = useMemo(
    () => parts.reduce((acc, x) => acc + (Number(x.qty) || 0) * (Number(x.unitPrice) || 0), 0),
    [parts]
  )
  const grandTotal = laborTotal + partsTotal

  useEffect(() => {
    const t = token
    if (!t) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [cRes, vRes, sRes, pRes] = await Promise.all([
          api.customers.list(t),
          api.vehicles.list(t),
          api.serviceCatalog.list(t),
          api.partCatalog.list(t),
        ])
        if (cancelled) return
        setCustomers(cRes.data || [])
        setVehicles(vRes.data || [])
        setServiceCatalog(sRes.data || [])
        setPartCatalog(pRes.data || [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar datos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

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

  useEffect(() => {
    if (prefillApplied) return
    const prefill = (location.state as any)?.prefill
    if (!prefill) return

    setCustomerId(prefill.customerId || '')
    setVehicleId(prefill.vehicleId || '')
    setServices(
      Array.isArray(prefill.services)
        ? prefill.services.map((s: any) => ({
            key: uid(),
            serviceCatalogId: '',
            isNew: true,
            name: s.name || '',
            laborPrice: String(s.laborPrice ?? '0'),
            notes: s.notes || '',
          }))
        : []
    )
    setParts(
      Array.isArray(prefill.parts)
        ? prefill.parts.map((x: any) => ({
            key: uid(),
            partCatalogId: '',
            isNew: true,
            name: x.name || '',
            brand: x.brand || '',
            sku: x.sku || '',
            qty: String(x.qty ?? '1'),
            unitPrice: String(x.unitPrice ?? '0'),
            notes: x.notes || '',
          }))
        : []
    )
    setStep(2)
    setPrefillApplied(true)
  }, [location.state, prefillApplied])

  function addService() {
    setServices((prev) => [
      ...prev,
      { key: uid(), serviceCatalogId: '', isNew: false, name: '', laborPrice: '0', notes: '' },
    ])
  }

  function addPart() {
    setParts((prev) => [
      ...prev,
      { key: uid(), partCatalogId: '', isNew: false, name: '', brand: '', sku: '', qty: '1', unitPrice: '0', notes: '' },
    ])
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

  function validateStep(current: number) {
    if (current === 1 && !customerId) return 'Elegí un cliente para continuar.'
    if (current === 1 && !selectedCustomerHasVehicles) return 'El cliente seleccionado no tiene vehículos asociados.'
    if (current === 2) {
      if (!vehicleId) return 'Elegí un vehículo del cliente.'
      if (!odometer.trim()) return 'Ingresá el kilometraje.'
      if (!receivedAt) return 'Ingresá fecha/hora de ingreso.'
      const currentOdometer = Number(odometer)
      if (!Number.isFinite(currentOdometer) || currentOdometer < 0) return 'Kilometraje inválido.'
      if (lastVehicleOdometer != null && currentOdometer < lastVehicleOdometer) {
        return `El kilometraje no puede ser menor al último registro (${lastVehicleOdometer}).`
      }
    }
    if (current === 3 && services.length === 0) return 'Agregá al menos un servicio.'
    if (current === 4 && parts.length === 0) return 'Agregá al menos un repuesto.'
    return null
  }

  async function onSubmitWizard() {
    const t = token
    if (!t) return
    const stepErr = validateStep(2) || validateStep(3) || validateStep(4)
    if (stepErr) {
      setError(stepErr)
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const preparedServices = [] as any[]
      for (const s of services) {
        if (s.serviceCatalogId) {
          preparedServices.push({ serviceCatalogId: s.serviceCatalogId, laborPrice: Number(s.laborPrice) || 0, notes: s.notes || null })
          continue
        }

        const inline = s.name.trim()
        if (!inline) throw new Error('Servicio sin nombre')
        const created = await createServiceCatalogInline(s)
        preparedServices.push({
          serviceCatalogId: created?.id || null,
          isNew: !created,
          name: inline,
          laborPrice: Number(s.laborPrice) || 0,
          notes: s.notes || null,
        })
      }

      const preparedParts = [] as any[]
      for (const pItem of parts) {
        if (pItem.partCatalogId) {
          preparedParts.push({
            partCatalogId: pItem.partCatalogId,
            qty: Number(pItem.qty) || 1,
            unitPrice: Number(pItem.unitPrice) || 0,
            notes: pItem.notes || null,
          })
          continue
        }

        const inline = pItem.name.trim()
        if (!inline) throw new Error('Repuesto sin nombre')
        const created = await createPartCatalogInline(pItem)
        preparedParts.push({
          partCatalogId: created?.id || null,
          isNew: !created,
          name: inline,
          brand: pItem.brand || null,
          sku: pItem.sku || null,
          qty: Number(pItem.qty) || 1,
          unitPrice: Number(pItem.unitPrice) || 0,
          notes: pItem.notes || null,
        })
      }

      await api.services.wizardCreate(t, {
        customerId,
        vehicleId,
        odometer: Number(odometer),
        receivedAt: new Date(receivedAt).toISOString(),
        intakeNotes: intakeNotes || null,
        services: preparedServices,
        parts: preparedParts,
      })

      const selectedVehicle = vehicles.find((v) => v.id === vehicleId)
      const selectedCustomer = customers.find((c) => c.id === customerId)
      const surname = String(selectedCustomer?.name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(-1)[0] || 'Cliente'
      const serviceDate = new Date(receivedAt || Date.now()).toLocaleDateString('es-AR')
      setSuccess(`Servicio registrado. ${selectedVehicle?.plate || 'Sin placa'} | ${surname} | ${serviceDate}`)
      setStep(1)
      setCustomerId('')
      setVehicleId('')
      setOdometer('')
      setIntakeNotes('')
      setServices([])
      setParts([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el servicio')
    } finally {
      setSaving(false)
    }
  }

  const stepTitles = ['Cliente', 'Vehículo', 'Servicios', 'Repuestos', 'Resumen']

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 26, fontWeight: 900 }}>Servicio</div>
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Wizard de ingreso, servicios, repuestos y presupuesto</div>
      </div>

      <Card style={{ borderColor: p.cardBorder, marginBottom: 14 }}>
        <CardSection style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: 14 }}>
          {stepTitles.map((label, i) => {
            const idx = i + 1
            return (
              <div
                key={label}
                style={{
                  height: 30,
                  borderRadius: 999,
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  border: '1px solid rgba(100,116,139,0.25)',
                  background: step === idx ? '#2563EB' : 'transparent',
                  color: step === idx ? '#fff' : 'inherit',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {idx}. {label}
              </div>
            )
          })}
        </CardSection>
      </Card>

      {loading ? (
        <Card>
          <CardSection>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CircularProgress size={24} />
              <div style={{ fontWeight: 900 }}>Cargando…</div>
            </div>
          </CardSection>
        </Card>
      ) : (
        <Card>
          <CardSection style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {step === 1 ? (
              <>
                <label style={{ fontSize: 13, fontWeight: 700 }}>Cliente</label>
                <Select value={customerId} onChange={(e) => {
                  const v = e.target.value
                  setCustomerId(v)
                  setVehicleId('')
                  setStep(1)
                }}>
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

            {step === 2 ? (
              <>
                <label style={{ fontSize: 13, fontWeight: 700 }}>Vehículo del cliente</label>
                <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                  <option value="">— Elegir vehículo —</option>
                  {vehiclesForCustomer.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} {(v.make || v.model) ? `• ${[v.make, v.model].filter(Boolean).join(' ')}` : ''}
                    </option>
                  ))}
                </Select>
                {!selectedCustomerHasVehicles ? (
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    No hay vehículos para este cliente. Primero cargá uno en la sección Vehículos.
                  </div>
                ) : null}

                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 13, fontWeight: 700 }}>Kilometraje</label>
                    <Input value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="Ej: 125000" />
                    {lastVehicleOdometer != null ? (
                      <div style={{ marginTop: 4, fontSize: 14, opacity: 0.75 }}>Último registrado: {lastVehicleOdometer}</div>
                    ) : null}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 13, fontWeight: 700 }}>Fecha/Hora ingreso</label>
                    <Input type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
                  </div>
                </div>
                <label style={{ fontSize: 13, fontWeight: 700 }}>Notas iniciales</label>
                <Textarea value={intakeNotes} onChange={(e) => setIntakeNotes(e.target.value)} rows={3} placeholder="Observaciones del ingreso" />
              </>
            ) : null}

            {step === 3 ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800 }}>Servicios</div>
                  <Button size="sm" onClick={addService}><Plus size={14} /> Agregar</Button>
                </div>

                {services.length === 0 ? <div style={{ fontSize: 13, opacity: 0.7 }}>Todavía no agregaste servicios.</div> : null}
                {services.map((s, idx) => (
                  <Card key={s.key} style={{ borderColor: p.cardBorder }}>
                    <CardSection style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 700 }}>Servicio #{idx + 1}</div>
                        <Button size="sm" variant="outline" onClick={() => setServices((prev) => prev.filter((x) => x.key !== s.key))}><Trash2 size={14} /></Button>
                      </div>
                      <Select value={s.serviceCatalogId} onChange={(e) => {
                        const v = e.target.value
                        setServices((prev) => prev.map((x) => {
                          if (x.key !== s.key) return x
                          if (!v) return { ...x, serviceCatalogId: '', isNew: true, name: '' }
                          const cat = serviceCatalog.find((c) => c.id === v)
                          return { ...x, serviceCatalogId: v, isNew: false, name: cat?.name || x.name, laborPrice: String(cat?.suggestedPrice ?? x.laborPrice) }
                        }))
                      }}>
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

            {step === 4 ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800 }}>Repuestos</div>
                  <Button size="sm" onClick={addPart}><Plus size={14} /> Agregar</Button>
                </div>

                {parts.length === 0 ? <div style={{ fontSize: 13, opacity: 0.7 }}>Todavía no agregaste repuestos.</div> : null}
                {parts.map((part, idx) => (
                  <Card key={part.key} style={{ borderColor: p.cardBorder }}>
                    <CardSection style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 700 }}>Repuesto #{idx + 1}</div>
                        <Button size="sm" variant="outline" onClick={() => setParts((prev) => prev.filter((x) => x.key !== part.key))}><Trash2 size={14} /></Button>
                      </div>
                      <Select value={part.partCatalogId} onChange={(e) => {
                        const v = e.target.value
                        setParts((prev) => prev.map((x) => {
                          if (x.key !== part.key) return x
                          if (!v) return { ...x, partCatalogId: '', isNew: true, name: '', brand: '', sku: '' }
                          const cat = partCatalog.find((c) => c.id === v)
                          return { ...x, partCatalogId: v, isNew: false, name: cat?.name || x.name, brand: cat?.brand || '', sku: cat?.sku || '', unitPrice: String(cat?.suggestedPrice ?? x.unitPrice) }
                        }))
                      }}>
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

            {step === 5 ? (
              <>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Resumen</div>
                <div style={{ fontSize: 13 }}>Servicios: <b>{services.length}</b></div>
                <div style={{ fontSize: 13 }}>Repuestos: <b>{parts.length}</b></div>
                <div style={{ fontSize: 13 }}>Mano de obra: <b>{laborTotal.toFixed(2)}</b></div>
                <div style={{ fontSize: 13 }}>Repuestos: <b>{partsTotal.toFixed(2)}</b></div>
                <div style={{ fontSize: 14, fontWeight: 900 }}>Total: {grandTotal.toFixed(2)}</div>
                <Button onClick={onSubmitWizard} disabled={saving}>{saving ? 'Guardando…' : 'Finalizar servicio'}</Button>
              </>
            ) : null}

            {error ? <div style={{ color: '#FCA5A5', fontWeight: 700 }}>{error}</div> : null}
            {success ? <div style={{ color: '#34D399', fontWeight: 700 }}>{success}</div> : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <Button variant='outline' disabled={step === 1 || saving} onClick={() => setStep((s) => Math.max(1, s - 1))}>Anterior</Button>
              <Button
                disabled={step === 5 || saving}
                onClick={() => {
                  const e = validateStep(step)
                  if (e) {
                    setError(e)
                    return
                  }
                  setError(null)
                  setStep((s) => Math.min(5, s + 1))
                }}
              >Siguiente</Button>
            </div>
          </CardSection>
        </Card>
      )}

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, opacity: 0.7, fontSize: 14 }}>
        <Wrench size={14} />
        El wizard crea Intake + Presupuesto + Historia clínica en una sola acción.
      </div>
    </div>
  )
}
