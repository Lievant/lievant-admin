import { NextRequest, NextResponse } from 'next/server';
import { proxyHelpdesk } from '../../../proxy';

type Params = { params: Promise<{ id: string }> };

/** Detalle de un ticket propio ("Mis tickets"). El API responde 404 si no es del usuario. */
export async function GET(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  return proxyHelpdesk(request, `/tickets/my/${encodeURIComponent(id)}`);
}
