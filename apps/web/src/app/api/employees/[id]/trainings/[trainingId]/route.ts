import { NextRequest, NextResponse } from 'next/server';
import { proxyEmployees } from '@/lib/employees-proxy';

type Ctx = { params: Promise<{ id: string; trainingId: string }> };

async function path(params: Ctx['params']): Promise<string> {
  const { id, trainingId } = await params;
  return `/${encodeURIComponent(id)}/trainings/${encodeURIComponent(trainingId)}`;
}

export async function PATCH(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxyEmployees(request, await path(params));
}

export async function DELETE(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxyEmployees(request, await path(params));
}
