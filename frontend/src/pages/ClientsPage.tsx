import React, { useEffect, useMemo, useState } from 'react'
import { Search, User } from 'lucide-react'
import { Badge, Button, Card, CardSection, Input, Modal, Select } from '../components/inline/Primitives'
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

export default function ClientsPage() {
  const p = usePalette()
  const { token } = useAuth()

  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<Client[]>([])
  const [vehicles, setVehicles] = useState<Array<{ id: string; customerId: string | null }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [creatingClient, setCreatingClient] = useState(false)
  const [clientFormError, setClientFormError] = useState<string | null>(null)
  const [clientForm, setClientForm] = useState({
    type: 'PARTICULAR',
    name: '',
    phone: '',
    email: '',
    doc: '',
  })

  useEffect(() => {
    const t = token
    if (!t) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [customersRes, vehiclesRes] = await Promise.all([api.customers.list(t!), api.vehicles.list(t!)])
        if (cancelled) return
        setCustomers(customersRes.data || [])
        setVehicles(
          (vehiclesRes.data || []).map((v: any) => ({
            id: v.id,
            customerId: v.customerId ?? null,
          }))
        )
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Error al cargar clientes')
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

  const vehicleCountByCustomerId = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of vehicles) {
      if (!v.customerId) continue
      map.set(v.customerId, (map.get(v.customerId) || 0) + 1)
    }
    return map
  }, [vehicles])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = customers
    if (!q) return base
    return base.filter((c) => {
      return (
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.doc || '').toLowerCase().includes(q)
      )
    })
  }, [customers, query])

  const showEmpty = !loading && !error && filtered.length === 0

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
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Cargando…</div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>Consultando la API.</div>
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
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, email o teléfono..."
            style={{ paddingLeft: 40 }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {showEmpty ? (
          <Card style={{ gridColumn: '1 / -1', borderColor: p.cardBorder }}>
            <CardSection style={{ padding: 18 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Sin clientes todavía</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>Cuando agregues clientes desde el backend, aquí aparecerán.</div>
            </CardSection>
          </Card>
        ) : (
          filtered.map((c) => {
            const count = vehicleCountByCustomerId.get(c.id) || 0
            const name = c.name || '—'
            return (
              <Card key={c.id}>
                <CardSection style={{ padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 14, background: 'rgba(37,99,235,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(37,99,235,0.18)' }}>
                        <User size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 900 }}>{name}</div>
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
                    <Button variant="outline" style={{ width: '100%' }}>
                      Ver Detalles
                    </Button>
                  </div>
                </CardSection>
              </Card>
            )
          })
        )}
      </div>

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
              <Input
                value={clientForm.phone}
                onChange={(e) => setClientForm((s) => ({ ...s, phone: e.target.value }))}
                placeholder="+34 ..."
              />
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

          {clientFormError ? (
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
              {clientFormError}
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
            <Button
              variant="outline"
              disabled={creatingClient}
              onClick={() => {
                if (creatingClient) return
                setClientModalOpen(false)
                setClientFormError(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={creatingClient}
              onClick={async () => {
                const t = token
                if (!t) return

                setClientFormError(null)
                const type = clientForm.type.trim()
                const name = clientForm.name.trim()

                if (!type || !name) {
                  setClientFormError('El tipo y el nombre son requeridos.')
                  return
                }

                setCreatingClient(true)
                try {
                  await api.customers.create(t!, {
                    type,
                    name,
                    phone: clientForm.phone.trim() || null,
                    email: clientForm.email.trim() || null,
                    doc: clientForm.doc.trim() || null,
                  })

                  // Recargar desde la API
                  const [customersRes, vehiclesRes] = await Promise.all([api.customers.list(t!), api.vehicles.list(t!)])
                  setCustomers(customersRes.data || [])
                  setVehicles(
                    (vehiclesRes.data || []).map((v: any) => ({
                      id: v.id,
                      customerId: v.customerId ?? null,
                    }))
                  )

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
    </div>
  )
}

