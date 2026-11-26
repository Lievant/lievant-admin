import { NextRequest, NextResponse } from 'next/server';
import { proxyHelpdesk } from '../../../proxy';

type Params = { params: Promise<{ id: string }> };

/** Encuesta del ticket: la ven el solicitante y TD (el API responde 403 a los demás). */
export async function GET(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  return proxyHelpdesk(request, `/tickets/${encodeURIComponent(id)}/survey`);
}

/** Body { rating, comment? }. Solo el solicitante de un ticket cerrado, una vez. */
export async function POST(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  return proxyHelpdesk(request, `/tickets/${encodeURIComponent(id)}/survey`, 'POST');
}
