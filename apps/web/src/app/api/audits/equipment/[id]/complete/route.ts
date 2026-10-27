import { NextRequest, NextResponse } from 'next/server';
import { proxyEquipmentAudits } from '@/lib/audits-proxy';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxyEquipmentAudits(request, `/${(await params).id}/complete`);
}
