import { NextRequest, NextResponse } from 'next/server';
import { proxyHr } from '@/lib/hr-proxy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return proxyHr(request, `/job-positions/${encodeURIComponent((await params).id)}/assign-to-employees`);
}
