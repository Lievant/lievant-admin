import { NextRequest, NextResponse } from 'next/server';
import { proxyEquipmentAudits } from '@/lib/audits-proxy';

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const { id, itemId } = await params;
  return proxyEquipmentAudits(request, `/${id}/equipment-items/${itemId}`);
}
