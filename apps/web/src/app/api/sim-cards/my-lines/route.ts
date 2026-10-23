import { NextRequest, NextResponse } from 'next/server';
import { proxySimCards } from '@/lib/sim-cards-proxy';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxySimCards(request, '/my-lines');
}
