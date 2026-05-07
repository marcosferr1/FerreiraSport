import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { Button, Card, CardSection, CircularProgress, Input, Modal, Select } from '../components/inline/Primitives'
import { useAuth } from '../auth/useAuth'
import { api } from '../api/client'

type PartItem = {
  id: string
  name: string
  brand?: string | null
  sku?: string | null
  description?: string | null
  suggestedPrice?: string | number | null
  active?: boolean
}

export default function PartCatalogPage() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<PartItem[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [createForm, setCreateForm] = useState({ name: '', brand: '', sku: '', description: '', suggestedPrice: '', active: true })
  const [editForm, setEditForm] = useState<PartItem | null>(null)
  const [pendingAction, setPendingAction] = useState<null | { kind: 'create' | 'update' | 'delete'; targetId?: string }>(null)

  async function load() {
    const t = token
    if (!t) return
    setLoading(true)
    setError(null)
    try {
      const active = statusFilter === 'all' ? undefined : statusFilter === 'active' ? 'true' : 'false'
      const res = await api.partCatalog.list(t, { q: q.trim() || undefined, active, page, pageSize })
      setItems(res.data || [])
      setTotal(res.meta?.total || 0)
      setTotalPages(res.meta?.totalPages || 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar repuestos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token, statusFilter, page, pageSize])

  const filtered = useMemo(() => items, [items])

  async function runConfirmedAction() {
    const t = token
    if (!t || !pendingAction) return

    try {
      if (pendingAction.kind === 'create') {
        await api.partCatalog.create(t, {
          name: createForm.name.trim(),
          brand: createForm.brand.trim() || null,
          sku: createForm.sku.trim() || null,
          description: createForm.description.trim() || null,
          suggestedPrice: createForm.suggestedPrice.trim() ? Number(createForm.suggestedPrice) : null,
          active: createForm.active,
        })
        setCreateOpen(false)
        setCreateForm({ name: '', brand: '', sku: '', description: '', suggestedPrice: '', active: true })
      }

      if (pendingAction.kind === 'update' && editForm) {
        await api.partCatalog.update(t, editForm.id, {
          name: editForm.name,
          brand: editForm.brand || null,
          sku: editForm.sku || null,
          description: editForm.description || null,
          suggestedPrice: editForm.suggestedPrice == null || editForm.suggestedPrice === '' ? null : Number(editForm.suggestedPrice),
          active: editForm.active !== false,
        })
        setEditOpen(false)
      }

      if (pendingAction.kind === 'delete' && pendingAction.targetId) {
        await api.partCatalog.remove(t, pendingAction.targetId)
      }

      setConfirmOpen(false)
      setPendingAction(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción')
      setConfirmOpen(false)
      setPendingAction(null)
    }
  }

  function openCreateConfirm() {
    if (!createForm.name.trim()) {
      setError('El nombre del repuesto es requerido.')
      return
    }
    setError(null)
    setPendingAction({ kind: 'create' })
    setConfirmOpen(true)
  }

  function openUpdateConfirm() {
    if (!editForm?.name?.trim()) {
      setError('El nombre del repuesto es requerido.')
      return
    }
    setError(null)
    setPendingAction({ kind: 'update' })
    setConfirmOpen(true)
  }

  function openDeleteConfirm(id: string) {
    setPendingAction({ kind: 'delete', targetId: id })
    setConfirmOpen(true)
  }

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>Repuestos (Catálogo)</div>
          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>Gestioná repuestos, precios y estado.</div>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus size={14} /> Nuevo repuesto</Button>
      </div>

      <Card style={{ marginBottom: 12 }}>
        <CardSection style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 2, minWidth: 220 }}>
            <div style={{ position: 'absolute', left: 12, top: 12, opacity: 0.7 }}><Search size={14} /></div>
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder='Buscar por nombre, marca o SKU...' style={{ paddingLeft: 34 }} />
          </div>
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1) }} style={{ flex: 1, minWidth: 180 }}>
            <option value='all'>Todos</option>
            <option value='active'>Activos</option>
            <option value='inactive'>Inactivos</option>
          </Select>
          <Select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} style={{ width: 120 }}>
            <option value='10'>10</option>
            <option value='20'>20</option>
            <option value='50'>50</option>
          </Select>
          <Button variant='outline' onClick={load}>Actualizar</Button>
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
      ) : null}
      {error ? <Card style={{ borderColor: 'rgba(239,68,68,0.35)' }}><CardSection>{error}</CardSection></Card> : null}

      {!loading && (
        <Card>
          <CardSection style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 12 }}>Nombre</th>
                    <th style={{ textAlign: 'left', padding: 12 }}>Marca</th>
                    <th style={{ textAlign: 'left', padding: 12 }}>SKU</th>
                    <th style={{ textAlign: 'right', padding: 12 }}>Precio sugerido</th>
                    <th style={{ textAlign: 'center', padding: 12 }}>Estado</th>
                    <th style={{ textAlign: 'right', padding: 12 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((it) => (
                    <tr key={it.id} style={{ borderTop: '1px solid rgba(148,163,184,0.2)' }}>
                      <td style={{ padding: 12, fontWeight: 700 }}>{it.name}</td>
                      <td style={{ padding: 12 }}>{it.brand || '—'}</td>
                      <td style={{ padding: 12 }}>{it.sku || '—'}</td>
                      <td style={{ padding: 12, textAlign: 'right' }}>{Number(it.suggestedPrice || 0).toFixed(2)}</td>
                      <td style={{ padding: 12, textAlign: 'center' }}>{it.active === false ? 'Inactivo' : 'Activo'}</td>
                      <td style={{ padding: 12, textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          <Button size='sm' variant='outline' onClick={() => { setEditForm({ ...it }); setEditOpen(true) }}><Pencil size={14} /> Editar</Button>
                          <Button size='sm' variant='outline' onClick={() => openDeleteConfirm(it.id)}><Trash2 size={14} /> Eliminar</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardSection>
        </Card>
      )}

      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, opacity: 0.75 }}>Mostrando {items.length} de {total} registros</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Button size='sm' variant='outline' disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
          <div style={{ fontSize: 13 }}>Página {page} / {totalPages}</div>
          <Button size='sm' variant='outline' disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Siguiente</Button>
        </div>
      </div>

      <Modal open={createOpen} title='Nuevo repuesto' onClose={() => setCreateOpen(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Input value={createForm.name} onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))} placeholder='Nombre' />
          <Input value={createForm.brand} onChange={(e) => setCreateForm((s) => ({ ...s, brand: e.target.value }))} placeholder='Marca' />
          <Input value={createForm.sku} onChange={(e) => setCreateForm((s) => ({ ...s, sku: e.target.value }))} placeholder='SKU' />
          <Input value={createForm.description} onChange={(e) => setCreateForm((s) => ({ ...s, description: e.target.value }))} placeholder='Descripción (opcional)' />
          <Input value={createForm.suggestedPrice} onChange={(e) => setCreateForm((s) => ({ ...s, suggestedPrice: e.target.value }))} placeholder='Precio sugerido' />
          <label style={{ fontSize: 13 }}><input type='checkbox' checked={createForm.active} onChange={(e) => setCreateForm((s) => ({ ...s, active: e.target.checked }))} /> Activo</label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant='outline' onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={openCreateConfirm}>Guardar</Button>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} title='Editar repuesto' onClose={() => setEditOpen(false)}>
        {editForm ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Input value={editForm.name || ''} onChange={(e) => setEditForm((s) => s ? { ...s, name: e.target.value } : s)} placeholder='Nombre' />
            <Input value={editForm.brand || ''} onChange={(e) => setEditForm((s) => s ? { ...s, brand: e.target.value } : s)} placeholder='Marca' />
            <Input value={editForm.sku || ''} onChange={(e) => setEditForm((s) => s ? { ...s, sku: e.target.value } : s)} placeholder='SKU' />
            <Input value={editForm.description || ''} onChange={(e) => setEditForm((s) => s ? { ...s, description: e.target.value } : s)} placeholder='Descripción (opcional)' />
            <Input value={editForm.suggestedPrice ?? ''} onChange={(e) => setEditForm((s) => s ? { ...s, suggestedPrice: e.target.value } : s)} placeholder='Precio sugerido' />
            <label style={{ fontSize: 13 }}><input type='checkbox' checked={editForm.active !== false} onChange={(e) => setEditForm((s) => s ? { ...s, active: e.target.checked } : s)} /> Activo</label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant='outline' onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button onClick={openUpdateConfirm}>Guardar cambios</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={confirmOpen} title='Confirmar acción' onClose={() => setConfirmOpen(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 14 }}>
            {pendingAction?.kind === 'delete' ? '¿Seguro que querés eliminar este repuesto?' : '¿Confirmás guardar los cambios?'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant='outline' onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={runConfirmedAction}>Confirmar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
