import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CarFront } from 'lucide-react'
import { Badge, Button, Card, CardSection, CircularProgress, Input, Modal, Select } from '../components/inline/Primitives'
import { usePalette } from '../theme/ThemeProvider'
import { useAuth } from '../auth/useAuth'
import { api } from '../api/client'

type Vehicle = {
  id: string
  plate: string
  make?: string | null
  model?: string | null
  year?: number | null
  customerId?: string | null
}

export default function VehiclesPage() {
  const p = usePalette()
  const { token } = useAuth()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [customers, setCustomers] = useState<Array<{ id: string; name?: string | null }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false)
  const [creatingVehicle, setCreatingVehicle] = useState(false)
  const [vehicleFormError, setVehicleFormError] = useState<string | null>(null)
  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [creatingInlineClient, setCreatingInlineClient] = useState(false)
  const [inlineClientError, setInlineClientError] = useState<string | null>(null)
  const [inlineClientForm, setInlineClientForm] = useState({
    type: 'PARTICULAR',
    name: '',
    phone: '',
    email: '',
    doc: '',
  })
  const [vehicleForm, setVehicleForm] = useState({
    plate: '',
    make: '',
    model: '',
    year: '',
    customerId: '',
  })
  const [catalogBrands, setCatalogBrands] = useState<Array<{ id: string; name: string }>>([])
  const [catalogModels, setCatalogModels] = useState<Array<{ id: string; name: string }>>([])
  /** '' | uuid del catálogo | '__manual__' (escribir marca a mano) */
  const [selectedBrandId, setSelectedBrandId] = useState<string>('')
  /** '' | nombre del modelo del catálogo | '__manual__' (escribir modelo a mano) */
  const [modelSelectKey, setModelSelectKey] = useState<string>('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null)
  const [deletingVehicle, setDeletingVehicle] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    plate: '',
    make: '',
    model: '',
    year: '',
    customerId: '',
  })

  useEffect(() => {
    const t = token
    if (!t) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [vehiclesRes, customersRes] = await Promise.all([api.vehicles.list(t!), api.customers.list(t!)])
        if (cancelled) return
        setVehicles(vehiclesRes.data || [])
        setCustomers((customersRes.data || []).map((c: any) => ({ id: c.id, name: c.name })))
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Error al cargar vehículos')
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [token])

  /** Catálogo de marcas: cargar con la sesión (no solo al abrir el modal).
   * Si falla un refetch, NO vaciar la lista — antes el catch dejaba selects vacíos para siempre. */
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
        if (!cancelled) {
          // Mantener marcas ya cargadas; no hacer setCatalogBrands([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  /** Al abrir el modal, refrescar marcas en segundo plano (si falla, sigue lo ya cargado) */
  useEffect(() => {
    const t = token
    if (!t || !vehicleModalOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.vehicleBrands.list(t)
        if (cancelled) return
        setCatalogBrands((res as { data?: Array<{ id: string; name: string }> }).data || [])
      } catch {
        // ignorar: lista anterior sigue visible
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, vehicleModalOpen])

  /** Modelos del catálogo cuando hay una marca elegida en el select (no “otra marca”) */
  useEffect(() => {
    const t = token
    if (!t || !vehicleModalOpen) {
      setCatalogModels([])
      return
    }
    if (!selectedBrandId || selectedBrandId === '__manual__') {
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

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of customers) map.set(c.id, c.name || '')
    return map
  }, [customers])

  function formatVehicleTitle(v: Vehicle) {
    const parts = [v.make, v.model].filter(Boolean).map((x) => String(x).trim())
    const base = parts.join(' ')
    if (v.year) return `${base}${base ? ' ' : ''}${v.year}`
    return base || v.plate
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return vehicles
    return vehicles.filter((v) => {
      const owner = v.customerId ? customerNameById.get(v.customerId) || '' : ''
      return (
        v.plate.toLowerCase().includes(q) ||
        (v.make || '').toLowerCase().includes(q) ||
        (v.model || '').toLowerCase().includes(q) ||
        owner.toLowerCase().includes(q)
      )
    })
  }, [vehicles, query, customerNameById])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pagedVehicles = useMemo(() => {
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

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900 }}>Vehículos</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Gestión del registro de vehículos</div>
          </div>
          <Button disabled>+ Registrar Vehículo</Button>
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
            <div style={{ fontSize: 26, fontWeight: 900 }}>Vehículos</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Gestión del registro de vehículos</div>
          </div>
          <Button disabled>+ Registrar Vehículo</Button>
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
          <div style={{ fontSize: 26, fontWeight: 900 }}>Vehículos</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Gestión del registro de vehículos</div>
        </div>
        <Button
          onClick={() => {
            setVehicleFormError(null)
            setVehicleForm({ plate: '', make: '', model: '', year: '', customerId: '' })
            setCatalogModels([])
            setSelectedBrandId('')
            setModelSelectKey('')
            setVehicleModalOpen(true)
          }}
        >
          + Registrar Vehículo
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.7 }}>
            <Search size={16} />
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por marca, modelo, placa o propietario..."
            style={{ paddingLeft: 40 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {showEmpty ? (
          <Card style={{ borderColor: p.cardBorder }}>
            <CardSection style={{ padding: 18 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Sin vehículos todavía</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>Cuando registres vehículos desde el backend, aparecerán aquí.</div>
            </CardSection>
          </Card>
        ) : (
          pagedVehicles.map((v) => {
            const owner = v.customerId ? customerNameById.get(v.customerId) : ''
            const hasOwner = Boolean(owner && owner.trim().length > 0)
            const title = formatVehicleTitle(v)

            return (
              <Card key={v.id}>
                <CardSection style={{ padding: 18 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(37,99,235,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(37,99,235,0.18)' }}>
                        <CarFront size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 900 }}>{title}</div>
                        <div style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>{hasOwner ? owner : 'Sin cliente asignado'}</div>
                        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
                          <span style={{ fontWeight: 800, opacity: 0.9 }}>Placa:</span> {v.plate}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>
                          {v.year ? `Año: ${v.year}` : 'Año: —'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                      <Badge label={hasOwner ? 'Con cliente' : 'Sin cliente'} tone={hasOwner ? 'success' : 'warning'} />
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/app/vehiculos/${v.id}/historia`)}>Ver Historial</Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditError(null)
                            setEditingVehicleId(v.id)
                            setEditForm({
                              plate: v.plate || '',
                              make: v.make || '',
                              model: v.model || '',
                              year: v.year != null ? String(v.year) : '',
                              customerId: v.customerId || '',
                            })
                            setEditModalOpen(true)
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDeleteError(null)
                            setVehicleToDelete(v)
                            setDeleteModalOpen(true)
                          }}
                          style={{ borderColor: 'rgba(239,68,68,0.5)', color: '#ef4444' }}
                        >
                          Eliminar
                        </Button>
                        <Button variant="primary" size="sm" onClick={() => navigate('/app/servicios')}>Nuevo Servicio</Button>
                      </div>
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
            Página <b>{Math.min(page, totalPages)}</b> de <b>{totalPages}</b> · {filtered.length} vehículos
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
        open={vehicleModalOpen}
        title="Registrar Vehículo"
        onClose={() => {
          if (creatingVehicle) return
          setVehicleModalOpen(false)
          setVehicleFormError(null)
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Placa (requerido)</label>
            <Input value={vehicleForm.plate} onChange={(e) => setVehicleForm((s) => ({ ...s, plate: e.target.value }))} placeholder="ABC-1234" />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Marca (opcional)</label>
              <div style={{ fontSize: 14, opacity: 0.65, marginBottom: 2 }}>Elegí del listado o “Otra marca” para escribir a mano.</div>
              <Select
                value={selectedBrandId}
                onChange={(e) => {
                  const v = e.target.value
                  setSelectedBrandId(v)
                  setModelSelectKey('')
                  if (v === '' || v === '__manual__') {
                    setVehicleForm((s) => ({ ...s, make: v === '__manual__' ? s.make : '', model: '' }))
                  } else {
                    const b = catalogBrands.find((x) => x.id === v)
                    setVehicleForm((s) => ({ ...s, make: b?.name || '', model: '' }))
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
                <Input
                  value={vehicleForm.make}
                  onChange={(e) => setVehicleForm((s) => ({ ...s, make: e.target.value }))}
                  placeholder="Ej. Chevrolet, Toyota…"
                  autoComplete="off"
                />
              ) : null}
            </div>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Modelo (opcional)</label>
              <div style={{ fontSize: 14, opacity: 0.65, marginBottom: 2 }}>
                {selectedBrandId && selectedBrandId !== '__manual__'
                  ? 'Elegí del listado o “Otro modelo” para escribir.'
                  : 'Primero elegí una marca del catálogo, u otra marca a mano.'}
              </div>
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
                    <Input
                      value={vehicleForm.model}
                      onChange={(e) => setVehicleForm((s) => ({ ...s, model: e.target.value }))}
                      placeholder="Ej. Corsa Classic, Corolla…"
                      autoComplete="off"
                    />
                  ) : null}
                </>
              ) : selectedBrandId === '__manual__' ? (
                <Input
                  value={vehicleForm.model}
                  onChange={(e) => setVehicleForm((s) => ({ ...s, model: e.target.value }))}
                  placeholder="Ej. Corsa Classic, Corolla…"
                  autoComplete="off"
                />
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
                  Elegí primero la marca
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Año (opcional)</label>
              <Input value={vehicleForm.year} onChange={(e) => setVehicleForm((s) => ({ ...s, year: e.target.value }))} placeholder="2019" />
            </div>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Cliente (seleccionar o crear)</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={creatingVehicle}
                  onClick={() => {
                    setInlineClientError(null)
                    setInlineClientForm({ type: 'PARTICULAR', name: '', phone: '', email: '', doc: '' })
                    setClientModalOpen(true)
                  }}
                >
                  + Nuevo cliente
                </Button>
              </div>
              <Select value={vehicleForm.customerId} onChange={(e) => setVehicleForm((s) => ({ ...s, customerId: e.target.value }))}>
                <option value="">Sin cliente</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || 'Cliente'}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {vehicleFormError ? (
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
              {vehicleFormError}
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
            <Button
              variant="outline"
              disabled={creatingVehicle}
              onClick={() => {
                if (creatingVehicle) return
                setVehicleModalOpen(false)
                setVehicleFormError(null)
              }}
            >
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
                  await api.vehicles.create(t!, {
                    plate,
                    make: vehicleForm.make.trim() || null,
                    model: vehicleForm.model.trim() || null,
                    year,
                    customerId: vehicleForm.customerId || null,
                  })

                  const [vehiclesRes, customersRes] = await Promise.all([api.vehicles.list(t!), api.customers.list(t!)])
                  setVehicles(vehiclesRes.data || [])
                  setCustomers((customersRes.data || []).map((c: any) => ({ id: c.id, name: c.name })))

                  setVehicleModalOpen(false)
                  setVehicleForm({ plate: '', make: '', model: '', year: '', customerId: '' })
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
              {creatingVehicle ? 'Creando…' : 'Crear Vehículo'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={clientModalOpen}
        title="Nuevo Cliente"
        onClose={() => {
          if (creatingInlineClient) return
          setClientModalOpen(false)
          setInlineClientError(null)
        }}
        overlayStyle={{ background: 'rgba(2,6,23,0.78)', zIndex: 1200 }}
        panelStyle={{ boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Tipo</label>
            <Select value={inlineClientForm.type} onChange={(e) => setInlineClientForm((s) => ({ ...s, type: e.target.value }))}>
              <option value="PARTICULAR">PARTICULAR</option>
              <option value="EMPRESA">EMPRESA</option>
            </Select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Nombre</label>
            <Input
              value={inlineClientForm.name}
              onChange={(e) => setInlineClientForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="Ej: Juan Pérez"
            />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Teléfono</label>
              <Input
                value={inlineClientForm.phone}
                onChange={(e) => setInlineClientForm((s) => ({ ...s, phone: e.target.value }))}
                placeholder="+34 ..."
              />
            </div>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Email</label>
              <Input
                value={inlineClientForm.email}
                onChange={(e) => setInlineClientForm((s) => ({ ...s, email: e.target.value }))}
                placeholder="cliente@email.com"
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Documento (opcional)</label>
            <Input
              value={inlineClientForm.doc}
              onChange={(e) => setInlineClientForm((s) => ({ ...s, doc: e.target.value }))}
              placeholder="DNI/NIE/CIF"
            />
          </div>

          {inlineClientError ? (
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
              {inlineClientError}
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
            <Button
              variant="outline"
              disabled={creatingInlineClient}
              onClick={() => {
                if (creatingInlineClient) return
                setClientModalOpen(false)
                setInlineClientError(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={creatingInlineClient}
              onClick={async () => {
                const t = token
                if (!t) return
                setInlineClientError(null)

                const type = inlineClientForm.type.trim()
                const name = inlineClientForm.name.trim()
                if (!type || !name) {
                  setInlineClientError('El tipo y el nombre son requeridos.')
                  return
                }

                setCreatingInlineClient(true)
                try {
                  const createRes = await api.customers.create(t, {
                    type,
                    name,
                    phone: inlineClientForm.phone.trim() || null,
                    email: inlineClientForm.email.trim() || null,
                    doc: inlineClientForm.doc.trim() || null,
                  })
                  const created = createRes.data as { id?: string }
                  const customersRes = await api.customers.list(t)
                  const refreshed = (customersRes.data || []).map((c: any) => ({ id: c.id, name: c.name }))
                  setCustomers(refreshed)
                  const createdId = created?.id || ''
                  if (createdId) {
                    setVehicleForm((s) => ({ ...s, customerId: createdId }))
                  }
                  setClientModalOpen(false)
                } catch (e) {
                  setInlineClientError(e instanceof Error ? e.message : 'Error al crear cliente')
                } finally {
                  setCreatingInlineClient(false)
                }
              }}
            >
              {creatingInlineClient ? 'Creando…' : 'Crear Cliente'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={editModalOpen}
        title="Editar Vehículo"
        onClose={() => {
          if (savingEdit) return
          setEditModalOpen(false)
          setEditError(null)
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Placa (requerido)</label>
            <Input value={editForm.plate} onChange={(e) => setEditForm((s) => ({ ...s, plate: e.target.value }))} placeholder="ABC-1234" />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Marca</label>
              <Input value={editForm.make} onChange={(e) => setEditForm((s) => ({ ...s, make: e.target.value }))} placeholder="Toyota" />
            </div>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Modelo</label>
              <Input value={editForm.model} onChange={(e) => setEditForm((s) => ({ ...s, model: e.target.value }))} placeholder="Corolla" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Año</label>
              <Input value={editForm.year} onChange={(e) => setEditForm((s) => ({ ...s, year: e.target.value }))} placeholder="2019" />
            </div>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Cliente</label>
              <Select value={editForm.customerId} onChange={(e) => setEditForm((s) => ({ ...s, customerId: e.target.value }))}>
                <option value="">Sin cliente</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || 'Cliente'}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {editError ? (
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
              {editError}
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="outline" disabled={savingEdit} onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={savingEdit}
              onClick={async () => {
                const t = token
                if (!t || !editingVehicleId) return
                setEditError(null)
                const plate = editForm.plate.trim()
                if (!plate) {
                  setEditError('La placa es requerida.')
                  return
                }
                setSavingEdit(true)
                try {
                  const year = editForm.year.trim() ? Number(editForm.year.trim()) : null
                  await api.vehicles.update(t, editingVehicleId, {
                    plate,
                    make: editForm.make.trim() || null,
                    model: editForm.model.trim() || null,
                    year,
                    customerId: editForm.customerId || null,
                  })
                  const [vehiclesRes, customersRes] = await Promise.all([api.vehicles.list(t), api.customers.list(t)])
                  setVehicles(vehiclesRes.data || [])
                  setCustomers((customersRes.data || []).map((c: any) => ({ id: c.id, name: c.name })))
                  setEditModalOpen(false)
                } catch (e) {
                  setEditError(e instanceof Error ? e.message : 'No se pudo editar el vehículo')
                } finally {
                  setSavingEdit(false)
                }
              }}
            >
              {savingEdit ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteModalOpen}
        title="Eliminar vehículo"
        onClose={() => {
          if (deletingVehicle) return
          setDeleteModalOpen(false)
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.8 }}>
            {vehicleToDelete
              ? `¿Seguro que querés eliminar el vehículo ${vehicleToDelete.plate}?`
              : '¿Seguro que querés eliminar este vehículo?'}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Esta acción borra también en cascada el historial relacionado (ingresos, presupuestos, pagos y registros asociados). No se puede deshacer.
          </div>
          {deleteError ? (
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
              {deleteError}
            </div>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="outline" disabled={deletingVehicle} onClick={() => setDeleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={deletingVehicle}
              style={{ background: '#dc2626', color: '#fff' }}
              onClick={async () => {
                const t = token
                const v = vehicleToDelete
                if (!t || !v) return
                setDeleteError(null)
                setDeletingVehicle(true)
                try {
                  await api.vehicles.remove(t, v.id, { cascade: true })
                  const [vehiclesRes, customersRes] = await Promise.all([api.vehicles.list(t), api.customers.list(t)])
                  setVehicles(vehiclesRes.data || [])
                  setCustomers((customersRes.data || []).map((c: any) => ({ id: c.id, name: c.name })))
                  setDeleteModalOpen(false)
                  setVehicleToDelete(null)
                } catch (e) {
                  setDeleteError(e instanceof Error ? e.message : 'No se pudo eliminar el vehículo')
                } finally {
                  setDeletingVehicle(false)
                }
              }}
            >
              {deletingVehicle ? 'Eliminando…' : 'Eliminar vehículo'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

