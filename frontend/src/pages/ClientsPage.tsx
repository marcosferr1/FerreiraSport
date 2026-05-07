import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CarFront, Search, User } from 'lucide-react'
import { Badge, Button, Card, CardSection, CircularProgress, Input, Modal, Select } from '../components/inline/Primitives'
import { usePalette } from '../theme/ThemeProvider'
import { useAuth } from '../auth/useAuth'
import { api } from '../api/client'

type Client = {
  id: string
  type?: string | null
  name?: string | null
  phone?: string | null
  email?: string | null
  doc?: string | null
}

type Vehicle = {
  id: string
  plate: string
  make?: string | null
  model?: string | null
  year?: number | null
  customerId?: string | null
}

export default function ClientsPage() {
  const p = usePalette()
  const { token } = useAuth()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 12
  const [customers, setCustomers] = useState<Client[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [creatingClient, setCreatingClient] = useState(false)
  const [clientFormError, setClientFormError] = useState<string | null>(null)
  const [selectedVehicleIdForCreate, setSelectedVehicleIdForCreate] = useState('')
  const [inlineVehicleIdForCreate, setInlineVehicleIdForCreate] = useState<string | null>(null)
  const [clientForm, setClientForm] = useState({
    type: 'PARTICULAR',
    name: '',
    phone: '',
    email: '',
    doc: '',
  })

  const [vehicleModalOpen, setVehicleModalOpen] = useState(false)
  const [creatingVehicle, setCreatingVehicle] = useState(false)
  const [vehicleFormError, setVehicleFormError] = useState<string | null>(null)
  const [vehicleForm, setVehicleForm] = useState({ plate: '', make: '', model: '', year: '' })
  const [catalogBrands, setCatalogBrands] = useState<Array<{ id: string; name: string }>>([])
  const [catalogModels, setCatalogModels] = useState<Array<{ id: string; name: string }>>([])
  const [selectedBrandId, setSelectedBrandId] = useState<string>('')
  const [modelSelectKey, setModelSelectKey] = useState<string>('')

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [clientDetailsOpen, setClientDetailsOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailSaving, setDetailSaving] = useState(false)
  const [detailClient, setDetailClient] = useState<Client | null>(null)
  const [detailVehicles, setDetailVehicles] = useState<Vehicle[]>([])
  const [detailFormError, setDetailFormError] = useState<string | null>(null)
  const [detailForm, setDetailForm] = useState({ type: 'PARTICULAR', name: '', phone: '', email: '', doc: '' })
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  async function loadAll(t: string) {
    const [customersRes, vehiclesRes] = await Promise.all([api.customers.list(t), api.vehicles.list(t)])
    setCustomers(customersRes.data || [])
    setVehicles(vehiclesRes.data || [])
  }

  useEffect(() => {
    const t = token
    if (!t) return
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [customersRes, vehiclesRes] = await Promise.all([api.customers.list(t), api.vehicles.list(t)])
        if (cancelled) return
        setCustomers(customersRes.data || [])
        setVehicles(vehiclesRes.data || [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar clientes')
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
    if (!t) {
      setCatalogBrands([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.vehicleBrands.list(t)
        if (cancelled) return
        setCatalogBrands((res as { data?: Array<{ id: string; name: string }> }).data || [])
      } catch {
        // mantener último valor disponible
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    const t = token
    if (!t || !vehicleModalOpen || !selectedBrandId || selectedBrandId === '__manual__') {
      setCatalogModels([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.vehicleBrands.models(t, selectedBrandId)
        if (cancelled) return
        setCatalogModels((res as { data?: Array<{ id: string; name: string }> }).data || [])
      } catch {
        if (!cancelled) setCatalogModels([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, vehicleModalOpen, selectedBrandId])

  const vehicleCountByCustomerId = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of vehicles) {
      if (!v.customerId) continue
      map.set(v.customerId, (map.get(v.customerId) || 0) + 1)
    }
    return map
  }, [vehicles])

  const unassignedVehicles = useMemo(() => vehicles.filter((v) => !v.customerId), [vehicles])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) => {
      return (
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.doc || '').toLowerCase().includes(q)
      )
    })
  }, [customers, query])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pagedClients = useMemo(() => {
    const safePage = Math.min(page, totalPages)
    const from = (safePage - 1) * pageSize
    return filtered.slice(from, from + pageSize)
  }, [filtered, page, totalPages])

  const showEmpty = !loading && !error && filtered.length === 0

  useEffect(() => {
    setPage(1)
  }, [query])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  async function openDetails(clientId: string) {
    const t = token
    if (!t) return
    setSelectedClientId(clientId)
    setClientDetailsOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setDetailFormError(null)
    try {
      const res = await api.customers.get(t, clientId)
      const customer = (res.data || null) as (Client & { vehicles?: Vehicle[] }) | null
      if (!customer) throw new Error('Cliente no encontrado')
      setDetailClient(customer)
      setDetailVehicles(customer.vehicles || [])
      setDetailForm({
        type: customer.type || 'PARTICULAR',
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        doc: customer.doc || '',
      })
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'No se pudo cargar detalle de cliente')
    } finally {
      setDetailLoading(false)
    }
  }

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900 }}>Clientes</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Gestión de la base de datos de clientes</div>
          </div>
          <Button disabled>+ Nuevo Cliente</Button>
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
            <div style={{ fontSize: 26, fontWeight: 900 }}>Clientes</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Gestión de la base de datos de clientes</div>
          </div>
          <Button disabled>+ Nuevo Cliente</Button>
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

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>Clientes</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Gestión de la base de datos de clientes</div>
        </div>
        <Button
          onClick={() => {
            setClientFormError(null)
            setClientForm({ type: 'PARTICULAR', name: '', phone: '', email: '', doc: '' })
            setSelectedVehicleIdForCreate('')
            setInlineVehicleIdForCreate(null)
            setClientModalOpen(true)
          }}
        >
          + Nuevo Cliente
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.7 }}>
            <Search size={16} />
          </div>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, email o teléfono..." style={{ paddingLeft: 40 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {showEmpty ? (
          <Card style={{ gridColumn: '1 / -1', borderColor: p.cardBorder }}>
            <CardSection style={{ padding: 18 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Sin clientes todavía</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>Cuando agregues clientes, aquí aparecerán.</div>
            </CardSection>
          </Card>
        ) : (
          pagedClients.map((c) => {
            const count = vehicleCountByCustomerId.get(c.id) || 0
            return (
              <Card key={c.id}>
                <CardSection style={{ padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 14, background: 'rgba(37,99,235,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(37,99,235,0.18)' }}>
                        <User size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 900 }}>{c.name || '—'}</div>
                        <div style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>{c.phone || '—'}</div>
                      </div>
                    </div>
                    <Badge label={`${count} ${count === 1 ? 'vehículo' : 'vehículos'}`} tone="neutral" />
                  </div>
                  <div style={{ marginTop: 16, fontSize: 13, opacity: 0.75, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>{c.email || '—'}</div>
                    <div>{c.doc || '—'}</div>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <Button variant="outline" style={{ width: '100%' }} onClick={() => openDetails(c.id)}>
                      Ver Detalles
                    </Button>
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
            Página <b>{Math.min(page, totalPages)}</b> de <b>{totalPages}</b> · {filtered.length} clientes
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}

      <Modal
        open={clientModalOpen}
        title="Nuevo Cliente"
        onClose={() => {
          if (creatingClient) return
          setClientModalOpen(false)
          setClientFormError(null)
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Tipo</label>
            <Select value={clientForm.type} onChange={(e) => setClientForm((s) => ({ ...s, type: e.target.value }))}>
              <option value="PARTICULAR">PARTICULAR</option>
              <option value="EMPRESA">EMPRESA</option>
            </Select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Nombre</label>
            <Input value={clientForm.name} onChange={(e) => setClientForm((s) => ({ ...s, name: e.target.value }))} placeholder="Ej: Juan Pérez" />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Teléfono</label>
              <Input value={clientForm.phone} onChange={(e) => setClientForm((s) => ({ ...s, phone: e.target.value }))} placeholder="+34 ..." />
            </div>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Email</label>
              <Input value={clientForm.email} onChange={(e) => setClientForm((s) => ({ ...s, email: e.target.value }))} placeholder="cliente@email.com" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Documento (opcional)</label>
            <Input value={clientForm.doc} onChange={(e) => setClientForm((s) => ({ ...s, doc: e.target.value }))} placeholder="DNI/NIE/CIF" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Vehículo a vincular (opcional)</label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setVehicleForm({ plate: '', make: '', model: '', year: '' })
                  setVehicleFormError(null)
                  setSelectedBrandId('')
                  setModelSelectKey('')
                  setCatalogModels([])
                  setVehicleModalOpen(true)
                }}
              >
                + Crear vehículo
              </Button>
            </div>
            <Select value={selectedVehicleIdForCreate} onChange={(e) => setSelectedVehicleIdForCreate(e.target.value)}>
              <option value="">Sin vehículo</option>
              {inlineVehicleIdForCreate && !unassignedVehicles.some((v) => v.id === inlineVehicleIdForCreate) ? (
                <option value={inlineVehicleIdForCreate}>Vehículo recién creado</option>
              ) : null}
              {unassignedVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} {v.make || ''} {v.model || ''} {v.year || ''}
                </option>
              ))}
            </Select>
          </div>

          {clientFormError ? (
            <div style={{ borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.12)', padding: '10px 12px', fontSize: 13, color: '#FCA5A5', fontWeight: 700 }}>
              {clientFormError}
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
            <Button variant="outline" disabled={creatingClient} onClick={() => setClientModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={creatingClient}
              onClick={async () => {
                const t = token
                if (!t) return
                setClientFormError(null)
                const name = clientForm.name.trim()
                if (!name) {
                  setClientFormError('El nombre es requerido.')
                  return
                }

                setCreatingClient(true)
                try {
                  const createRes = await api.customers.create(t, {
                    type: clientForm.type.trim() || null,
                    name,
                    phone: clientForm.phone.trim() || null,
                    email: clientForm.email.trim() || null,
                    doc: clientForm.doc.trim() || null,
                  })
                  const created = createRes.data as Client
                  const vehicleToAttach = inlineVehicleIdForCreate || selectedVehicleIdForCreate
                  if (vehicleToAttach && created?.id) {
                    await api.vehicles.update(t, vehicleToAttach, { customerId: created.id })
                  }
                  await loadAll(t)
                  setClientModalOpen(false)
                } catch (e) {
                  setClientFormError(e instanceof Error ? e.message : 'Error al crear cliente')
                } finally {
                  setCreatingClient(false)
                }
              }}
            >
              {creatingClient ? 'Creando…' : 'Crear Cliente'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={vehicleModalOpen}
        title="Crear Vehículo"
        onClose={() => {
          if (creatingVehicle) return
          setVehicleModalOpen(false)
          setVehicleFormError(null)
        }}
        overlayStyle={{ background: 'rgba(2,6,23,0.78)', zIndex: 1200 }}
        panelStyle={{ boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Placa (requerido)</label>
            <Input value={vehicleForm.plate} onChange={(e) => setVehicleForm((s) => ({ ...s, plate: e.target.value }))} placeholder="ABC-1234" />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Marca (opcional)</label>
              <Select
                value={selectedBrandId}
                onChange={(e) => {
                  const v = e.target.value
                  setSelectedBrandId(v)
                  setModelSelectKey('')
                  if (v === '' || v === '__manual__') {
                    setVehicleForm((s) => ({ ...s, make: v === '__manual__' ? s.make : '', model: '' }))
                  } else {
                    const brand = catalogBrands.find((x) => x.id === v)
                    setVehicleForm((s) => ({ ...s, make: brand?.name || '', model: '' }))
                  }
                }}
              >
                <option value="">— Elegir marca —</option>
                {catalogBrands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
                <option value="__manual__">Otra marca (escribir)</option>
              </Select>
              {selectedBrandId === '__manual__' ? (
                <Input value={vehicleForm.make} onChange={(e) => setVehicleForm((s) => ({ ...s, make: e.target.value }))} placeholder="Ej. Toyota" />
              ) : null}
            </div>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Modelo (opcional)</label>
              {selectedBrandId && selectedBrandId !== '__manual__' ? (
                <>
                  <Select
                    value={modelSelectKey}
                    onChange={(e) => {
                      const v = e.target.value
                      setModelSelectKey(v)
                      if (v === '' || v === '__manual__') {
                        setVehicleForm((s) => ({ ...s, model: v === '__manual__' ? s.model : '' }))
                      } else {
                        setVehicleForm((s) => ({ ...s, model: v }))
                      }
                    }}
                  >
                    <option value="">— Elegir modelo —</option>
                    {catalogModels.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                    <option value="__manual__">Otro modelo (escribir)</option>
                  </Select>
                  {modelSelectKey === '__manual__' ? (
                    <Input value={vehicleForm.model} onChange={(e) => setVehicleForm((s) => ({ ...s, model: e.target.value }))} placeholder="Ej. Corolla" />
                  ) : null}
                </>
              ) : selectedBrandId === '__manual__' ? (
                <Input value={vehicleForm.model} onChange={(e) => setVehicleForm((s) => ({ ...s, model: e.target.value }))} placeholder="Ej. Corolla" />
              ) : (
                <div
                  style={{
                    height: 42,
                    padding: '0 12px',
                    borderRadius: 14,
                    border: `1px solid ${p.inputBorder}`,
                    background: p.inputBg,
                    opacity: 0.55,
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 13,
                  }}
                >
                  Elegí primero una marca
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ width: 160, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Año</label>
              <Input value={vehicleForm.year} onChange={(e) => setVehicleForm((s) => ({ ...s, year: e.target.value }))} placeholder="2020" />
            </div>
          </div>

          {vehicleFormError ? (
            <div style={{ borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.12)', padding: '10px 12px', fontSize: 13, color: '#FCA5A5', fontWeight: 700 }}>
              {vehicleFormError}
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="outline" disabled={creatingVehicle} onClick={() => setVehicleModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={creatingVehicle}
              onClick={async () => {
                const t = token
                if (!t) return
                setVehicleFormError(null)
                const plate = vehicleForm.plate.trim()
                if (!plate) {
                  setVehicleFormError('La placa es requerida.')
                  return
                }
                setCreatingVehicle(true)
                try {
                  const year = vehicleForm.year.trim() ? Number(vehicleForm.year.trim()) : null
                  const res = await api.vehicles.create(t, {
                    plate,
                    make: vehicleForm.make.trim() || null,
                    model: vehicleForm.model.trim() || null,
                    year: Number.isFinite(year) ? year : null,
                    customerId: null,
                  })
                  const created = res.data as Vehicle
                  setInlineVehicleIdForCreate(created.id)
                  setSelectedVehicleIdForCreate(created.id)
                  await loadAll(t)
                  setVehicleModalOpen(false)
                  setSelectedBrandId('')
                  setModelSelectKey('')
                  setCatalogModels([])
                } catch (e) {
                  setVehicleFormError(e instanceof Error ? e.message : 'Error al crear vehículo')
                } finally {
                  setCreatingVehicle(false)
                }
              }}
            >
              {creatingVehicle ? 'Creando…' : 'Crear vehículo'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={clientDetailsOpen}
        title="Detalle de Cliente"
        onClose={() => {
          if (detailSaving) return
          setClientDetailsOpen(false)
        }}
      >
        {detailLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CircularProgress size={24} />
            <div style={{ fontWeight: 900 }}>Cargando detalle…</div>
          </div>
        ) : detailError ? (
          <div style={{ fontSize: 13, color: '#FCA5A5' }}>{detailError}</div>
        ) : !detailClient ? (
          <div style={{ fontSize: 13, opacity: 0.8 }}>Cliente no encontrado.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Tipo</label>
                <Select value={detailForm.type} onChange={(e) => setDetailForm((s) => ({ ...s, type: e.target.value }))}>
                  <option value="PARTICULAR">PARTICULAR</option>
                  <option value="EMPRESA">EMPRESA</option>
                </Select>
              </div>
              <div style={{ flex: 2, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Nombre</label>
                <Input value={detailForm.name} onChange={(e) => setDetailForm((s) => ({ ...s, name: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Teléfono</label>
                <Input value={detailForm.phone} onChange={(e) => setDetailForm((s) => ({ ...s, phone: e.target.value }))} />
              </div>
              <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Email</label>
                <Input value={detailForm.email} onChange={(e) => setDetailForm((s) => ({ ...s, email: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Documento</label>
              <Input value={detailForm.doc} onChange={(e) => setDetailForm((s) => ({ ...s, doc: e.target.value }))} />
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 10 }}>Autos asociados ({detailVehicles.length})</div>
              {detailVehicles.length === 0 ? (
                <div style={{ fontSize: 13, opacity: 0.75 }}>No hay autos asociados.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  {detailVehicles.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setClientDetailsOpen(false)
                        navigate(`/app/vehiculos/${v.id}/historia`)
                      }}
                      style={{
                        borderRadius: 12,
                        border: `1px solid ${p.cardBorder}`,
                        background: p.cardBg,
                        color: p.text,
                        padding: 12,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CarFront size={16} />
                        <b>{v.plate}</b>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>{[v.make, v.model].filter(Boolean).join(' ') || 'Sin marca/modelo'}</div>
                      <div style={{ marginTop: 3, fontSize: 12, opacity: 0.7 }}>Año: {v.year || '—'}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {detailFormError ? (
              <div style={{ borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.12)', padding: '10px 12px', fontSize: 13, color: '#FCA5A5', fontWeight: 700 }}>
                {detailFormError}
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <Button variant="outline" disabled={detailSaving} style={{ borderColor: 'rgba(239,68,68,0.5)', color: '#ef4444' }} onClick={() => setDeleteConfirmOpen(true)}>
                Eliminar cliente
              </Button>

              <Button
                disabled={detailSaving}
                onClick={async () => {
                  const t = token
                  if (!t || !selectedClientId) return
                  setDetailSaving(true)
                  setDetailFormError(null)
                  try {
                    await api.customers.update(t, selectedClientId, {
                      type: detailForm.type.trim() || null,
                      name: detailForm.name.trim() || null,
                      phone: detailForm.phone.trim() || null,
                      email: detailForm.email.trim() || null,
                      doc: detailForm.doc.trim() || null,
                    })
                    await loadAll(t)
                    await openDetails(selectedClientId)
                  } catch (e) {
                    setDetailFormError(e instanceof Error ? e.message : 'No se pudo actualizar el cliente')
                  } finally {
                    setDetailSaving(false)
                  }
                }}
              >
                {detailSaving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={deleteConfirmOpen}
        title="Eliminar cliente"
        onClose={() => {
          if (detailSaving) return
          setDeleteConfirmOpen(false)
        }}
        overlayStyle={{ background: 'rgba(2,6,23,0.78)', zIndex: 1300 }}
        panelStyle={{ boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.8 }}>
            ¿Qué querés hacer con los autos asociados a este cliente?
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              disabled={detailSaving}
              onClick={async () => {
                const t = token
                if (!t || !selectedClientId) return
                setDetailSaving(true)
                setDetailFormError(null)
                try {
                  await api.customers.remove(t, selectedClientId, { deleteVehicles: false })
                  await loadAll(t)
                  setDeleteConfirmOpen(false)
                  setClientDetailsOpen(false)
                } catch (e) {
                  setDetailFormError(e instanceof Error ? e.message : 'No se pudo eliminar el cliente')
                } finally {
                  setDetailSaving(false)
                }
              }}
            >
              Desvincular autos y eliminar
            </Button>
            <Button
              disabled={detailSaving}
              style={{ background: '#dc2626', color: '#fff' }}
              onClick={async () => {
                const t = token
                if (!t || !selectedClientId) return
                setDetailSaving(true)
                setDetailFormError(null)
                try {
                  await api.customers.remove(t, selectedClientId, { deleteVehicles: true })
                  await loadAll(t)
                  setDeleteConfirmOpen(false)
                  setClientDetailsOpen(false)
                } catch (e) {
                  setDetailFormError(e instanceof Error ? e.message : 'No se pudo eliminar el cliente y autos')
                } finally {
                  setDetailSaving(false)
                }
              }}
            >
              Eliminar cliente y autos
            </Button>
            <Button variant="outline" disabled={detailSaving} onClick={() => setDeleteConfirmOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

