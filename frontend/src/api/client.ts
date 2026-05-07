const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function apiFetch(path: string, options?: RequestInit) {
  // No hacer `{ headers: {...}, ...options }`: options.headers pisa todo y se pierde Content-Type,
  // Express no parsea el body JSON y llega plate undefined → 400 "plate requerido".
  const { headers: optsHeaders, ...rest } = options || {};
  const headers = new Headers(optsHeaders ?? undefined);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data?.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return res.json();
}

function buildQuery(params: Record<string, string | number | null | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    sp.set(k, String(v));
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

async function apiAuthFetch(token: string, path: string, options?: RequestInit) {
  return apiFetch(path, {
    ...options,
    headers: {
      ...(options?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

export const api = {
  login: (body: { email: string; password: string }) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: (token: string) =>
    apiFetch('/auth/me', { headers: { Authorization: `Bearer ${token}` } }),

  customers: {
    list: (token: string, params?: { type?: string; q?: string }) => {
      const qs = buildQuery({ type: params?.type, q: params?.q });
      return apiAuthFetch(token, `/customers${qs}`);
    },
    create: (token: string, body: { type?: string | null; name?: string | null; phone?: string | null; email?: string | null; doc?: string | null }) =>
      apiAuthFetch(token, '/customers', { method: 'POST', body: JSON.stringify(body) }),
  },

  vehicles: {
    list: (token: string, params?: { customerId?: string; q?: string }) => {
      const qs = buildQuery({ customerId: params?.customerId, q: params?.q });
      return apiAuthFetch(token, `/vehicles${qs}`);
    },
    create: (token: string, body: { plate: string; make?: string | null; model?: string | null; year?: number | null; customerId?: string | null }) =>
      apiAuthFetch(token, '/vehicles', { method: 'POST', body: JSON.stringify(body) }),
    history: (token: string, vehicleId: string) =>
      apiAuthFetch(token, `/vehicles/${encodeURIComponent(vehicleId)}/history`),
  },

  /** Catálogo marcas/modelos (Argentina), mismo auth que el resto */
  vehicleBrands: {
    list: (token: string, params?: { q?: string }) => {
      const qs = buildQuery({ q: params?.q });
      return apiAuthFetch(token, `/vehicle-brands${qs}`);
    },
    models: (token: string, brandId: string, params?: { q?: string }) => {
      const qs = buildQuery({ q: params?.q });
      return apiAuthFetch(token, `/vehicle-brands/${encodeURIComponent(brandId)}/models${qs}`);
    },
  },


  serviceCatalog: {
    list: (token: string, params?: { q?: string; active?: string; page?: number; pageSize?: number }) => {
      const qs = buildQuery({ q: params?.q, active: params?.active, page: params?.page, pageSize: params?.pageSize });
      return apiAuthFetch(token, `/service-catalogs${qs}`);
    },
    create: (token: string, body: { name: string; description?: string | null; suggestedPrice?: number | null; active?: boolean }) =>
      apiAuthFetch(token, '/service-catalogs', { method: 'POST', body: JSON.stringify(body) }),
    update: (
      token: string,
      id: string,
      body: { name?: string | null; description?: string | null; suggestedPrice?: number | null; active?: boolean }
    ) => apiAuthFetch(token, `/service-catalogs/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (token: string, id: string) => apiAuthFetch(token, `/service-catalogs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },

  partCatalog: {
    list: (token: string, params?: { q?: string; active?: string; page?: number; pageSize?: number }) => {
      const qs = buildQuery({ q: params?.q, active: params?.active, page: params?.page, pageSize: params?.pageSize });
      return apiAuthFetch(token, `/part-catalogs${qs}`);
    },
    create: (
      token: string,
      body: {
        name: string
        brand?: string | null
        sku?: string | null
        description?: string | null
        suggestedPrice?: number | null
        active?: boolean
      }
    ) => apiAuthFetch(token, '/part-catalogs', { method: 'POST', body: JSON.stringify(body) }),
    update: (
      token: string,
      id: string,
      body: {
        name?: string | null
        brand?: string | null
        sku?: string | null
        description?: string | null
        suggestedPrice?: number | null
        active?: boolean
      }
    ) => apiAuthFetch(token, `/part-catalogs/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (token: string, id: string) => apiAuthFetch(token, `/part-catalogs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },

  services: {
    wizardCreate: (
      token: string,
      body: {
        customerId: string
        vehicleId: string
        odometer: number
        receivedAt: string
        intakeNotes?: string | null
        services: Array<{
          serviceCatalogId?: string | null
          isNew?: boolean
          name?: string
          laborPrice?: number
          notes?: string | null
        }>
        parts: Array<{
          partCatalogId?: string | null
          isNew?: boolean
          name?: string
          brand?: string | null
          sku?: string | null
          qty?: number
          unitPrice?: number
          notes?: string | null
        }>
      }
    ) => apiAuthFetch(token, '/services/wizard', { method: 'POST', body: JSON.stringify(body) }),
  },

  budgets: {
    list: (token: string, params?: { status?: string; customerId?: string; vehicleId?: string }) => {
      const qs = buildQuery({ status: params?.status, customerId: params?.customerId, vehicleId: params?.vehicleId });
      return apiAuthFetch(token, `/budgets${qs}`);
    },
    updateStatus: (token: string, budgetId: string, body: { newStatus: string; reason?: string | null }) =>
      apiAuthFetch(token, `/budgets/${budgetId}/status`, { method: 'PATCH', body: JSON.stringify(body) }),
    create: (
      token: string,
      body: {
        customerId?: string | null
        vehicleId?: string | null
        intakeId?: string | null
        status?: string
        odometer?: number | null
        receivedAt?: string | null
        budgetNotes?: string | null
        lines?: Array<{ description: string; qty?: number; unitPrice?: number }>
      }
    ) => apiAuthFetch(token, '/budgets', { method: 'POST', body: JSON.stringify(body) }),
  },

  payments: {
    list: (token: string, params?: { from?: string; to?: string; method?: string; customerId?: string; q?: string }) => {
      const qs = buildQuery({
        from: params?.from,
        to: params?.to,
        method: params?.method,
        customerId: params?.customerId,
        q: params?.q,
      });
      return apiAuthFetch(token, `/payments${qs}`);
    },
    get: (token: string, id: string) => apiAuthFetch(token, `/payments/${encodeURIComponent(id)}`),
    create: (
      token: string,
      body: {
        amount: number
        method: string
        paidAt: string
        customerId?: string | null
        vehicleId?: string | null
        intakeId?: string | null
        budgetId?: string | null
        note?: string | null
        reference?: string | null
      }
    ) => apiAuthFetch(token, '/payments', { method: 'POST', body: JSON.stringify(body) }),
  },
};

