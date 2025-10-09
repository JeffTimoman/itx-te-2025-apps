export type Gift = {
  id: number;
  name: string;
  description?: string | null;
  quantity: number;
  gift_category_id?: number | null;
  created_at?: string | null;
};

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || '';

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) throw await res.json();
  return res.json();
}

type ApiError = { error?: string; message?: string } | string;

const giftsApi = {
  listGifts: async (): Promise<Gift[]> => req('/api/admin/gifts'),
  listGiftCategories: async (): Promise<{ id: number; name: string }[]> => req('/api/admin/gift-categories'),
  createGift: async (payload: { name: string; description?: string | null; quantity?: number; gift_category_id?: number | null }): Promise<Gift> => req('/api/admin/gifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  updateGift: async (id: number, payload: Partial<{ name: string; description: string | null; quantity: number; gift_category_id?: number | null }>): Promise<Gift> => req(`/api/admin/gifts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  deleteGift: async (id: number): Promise<{ success: true }> => req(`/api/admin/gifts/${id}`, { method: 'DELETE' }),
};

export default giftsApi;
export { req };
export type { ApiError };
