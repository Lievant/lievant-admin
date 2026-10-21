import { NextRequest, NextResponse } from 'next/server';
import { proxySimCards } from '@/lib/sim-cards-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ equipmentId: string }> },
): Promise<NextResponse> {
  return proxySimCards(request, `/for-equipment/${(await params).equipmentId}`);
}
