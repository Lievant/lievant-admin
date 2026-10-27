import { NextRequest, NextResponse } from 'next/server';
import { proxyEmployees } from '@/lib/employees-proxy';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxyEmployees(request, `/${encodeURIComponent((await params).id)}/trainings`);
}

export async function POST(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxyEmployees(request, `/${encodeURIComponent((await params).id)}/trainings`);
}
