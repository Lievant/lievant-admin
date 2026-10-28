import { NextRequest, NextResponse } from 'next/server';
import { proxyHr } from '@/lib/hr-proxy';

type Ctx = { params: Promise<{ kpiId: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxyHr(request, `/job-position-kpis/${encodeURIComponent((await params).kpiId)}`);
}

export async function DELETE(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxyHr(request, `/job-position-kpis/${encodeURIComponent((await params).kpiId)}`);
}
