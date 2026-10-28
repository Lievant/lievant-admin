import { NextRequest, NextResponse } from 'next/server';
import { proxyHr } from '@/lib/hr-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
): Promise<NextResponse> {
  return proxyHr(request, `/okr-evaluations/my-team/${encodeURIComponent((await params).employeeId)}`);
}
