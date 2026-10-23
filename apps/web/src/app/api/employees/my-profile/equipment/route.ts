import { NextRequest, NextResponse } from 'next/server';
import { proxyEmployees } from '@/lib/employees-proxy';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyEmployees(request, '/my-profile/equipment');
}
