export async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) }
  const body = options.body
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: 'include',
    body: body !== undefined && typeof body !== 'string' && !(body instanceof FormData) ? JSON.stringify(body) : body,
  })
  const payload = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed (${response.status}).`)
    error.status = response.status
    throw error
  }
  return payload
}

export function queryString(values) {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  return params.toString()
}

export function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en', options).format(date)
}

export function timeAgo(value) {
  if (!value) return 'No activity yet'
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
