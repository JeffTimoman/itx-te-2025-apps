const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || '';

export type Registrant = {
  id: number;
  name: string;
  gacha_code: string;
  gifts?: Array<{ gift_id: number; name: string }> | null;
  email?: string | null;
  is_win?: string;
  is_verified?: string;
  is_send_email?: string;
  bureau?: string | null;
  created_at?: string;
};

async function fetchJson<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...opts });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${res.statusText} - ${txt}`);
  }
  return (await res.json()) as T;
}

export async function listRegistrants(): Promise<Registrant[]> {
  return fetchJson<Registrant[]>(`${BASE}/api/admin/registrants`);
}

export async function createRegistrant(payload: { name: string; email?: string | null; bureau?: string | null }): Promise<Registrant> {
  return fetchJson<Registrant>(`${BASE}/api/admin/registrants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateRegistrant(id: number, patch: Partial<Registrant>): Promise<Registrant> {
  return fetchJson<Registrant>(`${BASE}/api/admin/registrants/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function resendVerificationEmail(id: number): Promise<{ ok: boolean }> {
  return fetchJson<{ ok: boolean }>(`${BASE}/api/admin/registrants/${id}/resend-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

const api = { listRegistrants, createRegistrant, updateRegistrant };
export default api;
