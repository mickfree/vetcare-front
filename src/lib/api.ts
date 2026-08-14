const API_BASE = import.meta.env.PUBLIC_API_BASE_URL || '/api/v1';

export type ApiOptions = RequestInit & { auth?: boolean };

export function getAccessToken() {
  return localStorage.getItem('vetcare_access');
}

export function saveSession(access: string, refresh: string) {
  localStorage.setItem('vetcare_access', access);
  localStorage.setItem('vetcare_refresh', refresh);
}

export function clearSession() {
  localStorage.removeItem('vetcare_access');
  localStorage.removeItem('vetcare_refresh');
  localStorage.removeItem('vetcare_profile');
}

export function currentUserId(): number | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return Number(payload.user_id) || null;
  } catch {
    return null;
  }
}

function readableError(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'No fue posible completar la solicitud.';
  const entries = Object.entries(payload as Record<string, unknown>);
  if (!entries.length) return 'No fue posible completar la solicitud.';
  return entries.map(([key, value]) => {
    const label = key === 'detail' || key === 'non_field_errors' ? '' : `${key}: `;
    return `${label}${Array.isArray(value) ? value.join(', ') : String(value)}`;
  }).join(' · ');
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { auth = true, headers, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has('Content-Type') && requestOptions.body) {
    requestHeaders.set('Content-Type', 'application/json');
  }
  if (auth) {
    const token = getAccessToken();
    if (!token) throw new Error('Tu sesión terminó. Vuelve a ingresar.');
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...requestOptions, headers: requestHeaders });
  if (response.status === 401 && auth) {
    clearSession();
    window.location.href = '/login?expired=1';
    throw new Error('Sesión expirada');
  }
  if (!response.ok) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw new Error(readableError(payload));
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
