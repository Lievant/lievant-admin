import { NextRequest, NextResponse } from 'next/server';
import { proxyHelpdesk } from '../../proxy';

/** Indicadores de satisfacción (solo TD; el API responde 403 a los demás). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyHelpdesk(request, `/surveys/summary${request.nextUrl.search}`);
}
