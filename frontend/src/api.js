const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request(path, { method = 'GET', body, adminKey } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (adminKey) headers['X-Admin-Key'] = adminKey
  let res
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK', '인터넷 연결을 확인해 주세요.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, data?.code ?? 'ERROR', data?.message ?? '잠시 후 다시 시도해 주세요.')
  }
  return data
}

export const api = {
  lots: () => request('/lots'),
  /** 주차장 목록 + 서버 기준 시각 (시연 시계 반영) */
  board: async () => {
    const [lots, t] = await Promise.all([request('/lots'), request('/now').catch(() => null)])
    return { lots, now: t ? new Date(t.now) : new Date() }
  },
  lot: (code) => request(`/lots/${encodeURIComponent(code)}`),
  shuttle: () => request('/shuttle'),
  places: () => request('/places'),

  admin: {
    summary: (k) => request('/admin/summary', { adminKey: k }),
    addLot: (k, body) => request('/admin/lots', { method: 'POST', body, adminKey: k }),
    updateLot: (k, code, body) => request(`/admin/lots/${encodeURIComponent(code)}`, { method: 'PATCH', body, adminKey: k }),
    events: (k, code) => request(`/admin/lots/${encodeURIComponent(code)}/events?limit=20`, { adminKey: k }),
    sensors: (k, code) => request(`/admin/lots/${encodeURIComponent(code)}/sensors`, { adminKey: k }),
    demoReset: (k) => request('/admin/demo/reset', { method: 'POST', adminKey: k }),
    addPlace: (k, body) => request('/admin/places', { method: 'POST', body, adminKey: k }),
    updatePlace: (k, id, body) => request(`/admin/places/${id}`, { method: 'PATCH', body, adminKey: k }),
    deletePlace: (k, id) => request(`/admin/places/${id}`, { method: 'DELETE', adminKey: k }),
  },
}
