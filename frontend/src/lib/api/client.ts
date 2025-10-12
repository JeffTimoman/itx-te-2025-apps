const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || '';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('itx:admin:token');
  } catch {
    return null;
  }
}

export async function authFetch(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = Object.assign({}, (opts.headers as Record<string,string>) || {});
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  return fetch(url, { ...opts, headers });
}

export default authFetch;
