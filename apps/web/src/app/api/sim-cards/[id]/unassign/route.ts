import { NextRequest, NextResponse } from 'next/server';
import { proxySimCards } from '@/lib/sim-cards-proxy';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxySimCards(request, `/${(await params).id}/unassign`);
}
