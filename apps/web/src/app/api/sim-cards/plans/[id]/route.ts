import { NextRequest, NextResponse } from 'next/server';
import { proxySimCards } from '@/lib/sim-cards-proxy';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxySimCards(request, `/plans/${(await params).id}`);
}

export async function DELETE(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxySimCards(request, `/plans/${(await params).id}`);
}
