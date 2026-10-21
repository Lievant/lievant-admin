import { NextRequest, NextResponse } from 'next/server';
import { proxyEquipmentAudits } from '@/lib/audits-proxy';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxyEquipmentAudits(request, `/${(await params).id}`);
}

export async function PATCH(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxyEquipmentAudits(request, `/${(await params).id}`);
}
