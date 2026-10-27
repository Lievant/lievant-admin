import { NextRequest, NextResponse } from 'next/server';
import { proxyEmployees } from '@/lib/employees-proxy';

/** RIAC: áreas y divisiones disponibles para los filtros. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyEmployees(request, '/trainings/report/options');
}
