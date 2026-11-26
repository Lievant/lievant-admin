import { NextRequest, NextResponse } from 'next/server';
import { proxyPasswords } from '../../proxy';

type Params = { params: Promise<{ id: string }> };

/** Historial de transferencias de la cuenta, del más reciente al más antiguo. Sin contraseñas. */
export async function GET(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  return proxyPasswords(request, `/${encodeURIComponent(id)}/transfers`);
}
