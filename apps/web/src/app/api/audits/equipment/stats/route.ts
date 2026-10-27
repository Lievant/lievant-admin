import { NextRequest, NextResponse } from 'next/server';
import { proxyEquipmentAudits } from '@/lib/audits-proxy';

export function GET(request: NextRequest): Promise<NextResponse> {
  return proxyEquipmentAudits(request, '/stats');
}
