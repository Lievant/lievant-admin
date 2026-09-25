import { NextRequest, NextResponse } from 'next/server';
import { proxyPasswords } from '../../proxy';

type Params = { params: Promise<{ id: string }> };

/** ?action=ver|copiar — queda en la bitácora de auditoría del API. */
export async function GET(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  return proxyPasswords(request, `/${encodeURIComponent(id)}/reveal`);
}
