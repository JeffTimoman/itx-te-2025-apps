import { redirect } from 'next/navigation';

// Server-side redirector: call backend admin endpoint to generate a code for registrant id
export default async function Generate({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (Number.isNaN(id)) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-xl font-bold">Invalid registrant id</h1>
        <p>Please check the QR or link and try again.</p>
      </div>
    );
  }

  try {
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_BASE || 'http://localhost:5000';
    const resp = await fetch(`${BACKEND}/api/admin/registrants/${id}/generate-code`, { method: 'POST' });
    if (!resp.ok) {
      const txt = await resp.text();
      return (
        <div className="max-w-xl mx-auto p-6">
          <h1 className="text-xl font-bold">Failed to generate code</h1>
          <pre className="mt-2 whitespace-pre-wrap">{`Status: ${resp.status}\n${txt}`}</pre>
        </div>
      );
    }
    const body = await resp.json();
    const path = body.verifyPath || `/registrations/verify/${body.code}`;
    // redirect user-agent to verify path (frontend route)
    redirect(path);
    return null;
  } catch {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-xl font-bold">Server error</h1>
        <p>Unable to generate verification code. Please try again later.</p>
      </div>
    );
  }
}
