import { NextRequest, NextResponse } from 'next/server';
import { proxySimCards } from '@/lib/sim-cards-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
): Promise<NextResponse> {
  return proxySimCards(request, `/by-employee/${(await params).employeeId}`);
}
