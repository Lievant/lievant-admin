import { NextRequest, NextResponse } from 'next/server';
import { proxyHelpdesk } from '../../../proxy';

/** "Confirmar resolución" desde "Mis tickets": el API valida que el ticket sea del usuario. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  return proxyHelpdesk(request, `/tickets/${encodeURIComponent(id)}/confirm-resolution`, 'PATCH');
}
