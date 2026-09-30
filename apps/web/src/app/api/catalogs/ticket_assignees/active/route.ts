import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/**
 * Proxy acotado al catálogo de Técnicos de soporte TI (activos), para el selector
 * de técnico del diálogo de mantenimiento. A propósito solo expone
 * `ticket_assignees/active`, no un proxy genérico de catálogos.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const accessToken = request.cookies.get('access_token')?.value;

  const res = await fetch(`${API_URL}/catalogs/ticket_assignees/active`, {
    headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
  });

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
