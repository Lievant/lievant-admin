import { NextRequest, NextResponse } from 'next/server';
import { proxyHr } from '@/lib/hr-proxy';

type Ctx = { params: Promise<{ employeeId: string }> };

const eid = async (p: Ctx['params']) => encodeURIComponent((await p).employeeId);

export async function PATCH(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxyHr(request, `/employee-development/${await eid(params)}/position`);
}
