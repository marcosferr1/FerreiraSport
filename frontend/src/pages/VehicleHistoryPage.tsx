import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Wrench, Package } from 'lucide-react'
import { Button, Card, CardSection, CircularProgress } from '../components/inline/Primitives'
import { useAuth } from '../auth/useAuth'
import { api } from '../api/client'
import { usePalette } from '../theme/ThemeProvider'

type TimelineItem = {
  intake: {
    id: string
    status?: string
    receivedAt?: string
    odometer?: string | number | null
    notes?: string | null
  }
  clinicalRecord?: {
    notes?: string | null
    diagnosis?: string | null
    complaint?: string | null
    createdAt?: string
  } | null
  services?: Array<{ id: string; nameSnapshot?: string; laborPrice?: string | number; notes?: string | null }>
  parts?: Array<{ id: string; nameSnapshot?: string; qty?: string | number; unitPrice?: string | number; lineTotal?: string | number; notes?: string | null }>
  budget?: {
    id: string
    status?: string
    total?: string | number
  } | null
}

function formatDate(value: unknown) {
  if (!value) return '—'
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('es-AR')
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export default function VehicleHistoryPage() {
  const p = usePalette()
  const { token } = useAuth()
  const { vehicleId = '' } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vehicle, setVehicle] = useState<any>(null)
  const [timeline, setTimeline] = useState<TimelineItem[]>([])

  useEffect(() => {
    const t = token
    if (!t || !vehicleId) return
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await api.vehicles.history(t, vehicleId)
        if (cancelled) return
        setVehicle(res.data?.vehicle || null)
        setTimeline(res.data?.timeline || [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar historial')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, vehicleId])

  const summary = useMemo(() => {
    const latest = timeline[0]
    if (!latest) return null
    const servicesLabel = (latest.services || []).map((s) => s.nameSnapshot).filter(Boolean).join(', ')
    return {
      lastDate: latest.intake?.receivedAt,
      lastKm: latest.intake?.odometer,
      lastServices: servicesLabel || '—',
      lastTotal: num(latest.budget?.total),
    }
  }, [timeline])

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>Historia Clínica del Vehículo</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
            {vehicle ? `${vehicle.plate}${vehicle.make || vehicle.model ? ` • ${[vehicle.make, vehicle.model].filter(Boolean).join(' ')}` : ''}` : 'Vehículo'}
          </div>
        </div>
        <Button variant='outline' onClick={() => navigate('/app/vehiculos')}><ArrowLeft size={16} /> Volver</Button>
      </div>

      {loading ? (
        <Card>
          <CardSection>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CircularProgress size={24} />
              <div style={{ fontWeight: 900 }}>Cargando historial…</div>
            </div>
          </CardSection>
        </Card>
      ) : null}
      {error ? <Card style={{ borderColor: 'rgba(239,68,68,0.35)' }}><CardSection>{error}</CardSection></Card> : null}

      {!loading && !error && (
        <>
          <Card style={{ marginBottom: 14 }}>
            <CardSection>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Último service</div>
              {summary ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, fontSize: 13 }}>
                  <div><b>Fecha:</b> {formatDate(summary.lastDate)}</div>
                  <div><b>Kilometraje:</b> {summary.lastKm ?? '—'}</div>
                  <div><b>Servicios:</b> {summary.lastServices}</div>
                  <div><b>Total presupuesto:</b> {summary.lastTotal.toFixed(2)}</div>
                </div>
              ) : (
                <div style={{ opacity: 0.7, fontSize: 13 }}>Sin historial aún.</div>
              )}
            </CardSection>
          </Card>

          {timeline.length === 0 ? (
            <Card><CardSection style={{ fontSize: 13, opacity: 0.75 }}>No hay registros clínicos para este vehículo.</CardSection></Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {timeline.map((item) => (
                <Card key={item.intake.id}>
                  <CardSection style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 800 }}>Ingreso {item.intake.id.slice(0, 8).toUpperCase()}</div>
                      <div style={{ fontSize: 14, opacity: 0.75 }}>{formatDate(item.intake.receivedAt)} · {item.intake.odometer ?? '—'} km</div>
                    </div>

                    <div style={{ fontSize: 13 }}><b>Estado:</b> {item.intake.status || '—'}</div>
                    {item.intake.notes ? <div style={{ fontSize: 13 }}><b>Notas ingreso:</b> {item.intake.notes}</div> : null}

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13 }}><Wrench size={14} /> Servicios</div>
                      {(item.services || []).length === 0 ? <div style={{ fontSize: 13, opacity: 0.7 }}>Sin servicios cargados.</div> : (
                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {(item.services || []).map((s) => (
                            <div key={s.id} style={{ fontSize: 13 }}>• {s.nameSnapshot || 'Servicio'} — {num(s.laborPrice).toFixed(2)}</div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13 }}><Package size={14} /> Repuestos</div>
                      {(item.parts || []).length === 0 ? <div style={{ fontSize: 13, opacity: 0.7 }}>Sin repuestos cargados.</div> : (
                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {(item.parts || []).map((part) => (
                            <div key={part.id} style={{ fontSize: 13 }}>
                              • {part.nameSnapshot || 'Repuesto'} x{num(part.qty)} @ {num(part.unitPrice).toFixed(2)} = {num(part.lineTotal).toFixed(2)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: 13 }}>
                      <b>Presupuesto:</b>{' '}
                      {item.budget ? `${item.budget.id.slice(0, 8).toUpperCase()} · ${item.budget.status || '—'} · total ${num(item.budget.total).toFixed(2)}` : 'No registrado'}
                    </div>

                    {item.clinicalRecord ? (
                      <div style={{ fontSize: 13, borderTop: `1px solid ${p.cardBorder}`, paddingTop: 8 }}>
                        <div><b>Diagnóstico:</b> {item.clinicalRecord.diagnosis || '—'}</div>
                        {item.clinicalRecord.notes ? <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}><b>Notas clínicas:</b> {item.clinicalRecord.notes}</div> : null}
                      </div>
                    ) : null}
                  </CardSection>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
