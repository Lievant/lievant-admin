import { NextRequest, NextResponse } from 'next/server';
import { proxyPasswords } from '../../proxy';

type Params = { params: Promise<{ id: string }> };

/** Body { toEmployeeId, reason? }. El API valida quién puede transferir (dueño, jefe directo o SUPER_ADMIN). */
export async function POST(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  return proxyPasswords(request, `/${encodeURIComponent(id)}/transfer`, 'POST');
}
