import { NextRequest, NextResponse } from 'next/server';
import { proxyPasswords } from '../proxy';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  return proxyPasswords(request, `/${encodeURIComponent(id)}`, 'PATCH');
}

export async function DELETE(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  return proxyPasswords(request, `/${encodeURIComponent(id)}`, 'DELETE');
}
