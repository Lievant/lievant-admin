import { NextRequest, NextResponse } from 'next/server';
import { proxyHr } from '@/lib/hr-proxy';

type Ctx = { params: Promise<{ okrId: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxyHr(request, `/job-position-okrs/${encodeURIComponent((await params).okrId)}`);
}

export async function DELETE(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxyHr(request, `/job-position-okrs/${encodeURIComponent((await params).okrId)}`);
}
