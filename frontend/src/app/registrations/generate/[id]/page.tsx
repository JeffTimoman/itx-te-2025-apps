import { redirect } from 'next/navigation';

// Server-side redirector: call backend admin endpoint to generate a code for registrant id
export default async function Generate({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (Number.isNaN(id)) return new Response('Invalid id', { status: 400 });

  try {
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_BASE || 'http://localhost:5000';
    const resp = await fetch(`${BACKEND}/api/admin/registrants/${id}/generate-code`, { method: 'POST' });
    if (!resp.ok) {
      const txt = await resp.text();
      return new Response(`Failed to generate code: ${resp.status} ${txt}`, { status: 500 });
    }
    const body = await resp.json();
    const path = body.verifyPath || `/registrations/verify/${body.code}`;
    // redirect user-agent to verify path (frontend route)
    redirect(path);
  } catch {
    return new Response('Server error', { status: 500 });
  }
}
