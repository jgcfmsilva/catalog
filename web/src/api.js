const KEY = 'catalog_token';

export const getToken = () => {
  try { return localStorage.getItem(KEY); } catch { return null; }
};
export const setToken = (t) => {
  try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* ignore */ }
};

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const res = await fetch('/api' + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && path !== '/auth/login') {
    setToken(null);
    onUnauthorized();
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  me: () => request('/auth/me'),
  search: (q) => request('/search?q=' + encodeURIComponent(q)),
  list: () => request('/titles'),
  add: (body) => request('/titles', { method: 'POST', body }),
  update: (id, body) => request(`/titles/${id}`, { method: 'PATCH', body }),
  refresh: (id) => request(`/titles/${id}/refresh`, { method: 'POST' }),
  remove: (id) => request(`/titles/${id}`, { method: 'DELETE' }),
};
