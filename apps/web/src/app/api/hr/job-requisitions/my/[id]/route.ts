import { NextRequest, NextResponse } from 'next/server';
import { proxyHr } from '@/lib/hr-proxy';

type Ctx = { params: Promise<{ id: string }> };

const id = async (p: Ctx['params']) => encodeURIComponent((await p).id);

export async function GET(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxyHr(request, `/job-requisitions/my/${await id(params)}`);
}

export async function PATCH(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxyHr(request, `/job-requisitions/my/${await id(params)}`);
}

export async function DELETE(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxyHr(request, `/job-requisitions/my/${await id(params)}`);
}
