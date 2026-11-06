import { NextRequest, NextResponse } from 'next/server';
import { proxyHr } from '@/lib/hr-proxy';

type Ctx = { params: Promise<{ activityId: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxyHr(request, `/job-position-activities/${encodeURIComponent((await params).activityId)}`);
}

export async function DELETE(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxyHr(request, `/job-position-activities/${encodeURIComponent((await params).activityId)}`);
}
