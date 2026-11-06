import { NextRequest, NextResponse } from 'next/server';
import { proxyHr } from '@/lib/hr-proxy';

type Ctx = { params: Promise<{ employeeId: string; employeeOkrId: string }> };

export async function PUT(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const { employeeId, employeeOkrId } = await params;
  return proxyHr(request, `/okr-evaluations/my-team/${encodeURIComponent(employeeId)}/okrs/${encodeURIComponent(employeeOkrId)}`);
}
