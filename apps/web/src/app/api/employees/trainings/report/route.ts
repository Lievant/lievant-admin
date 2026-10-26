import { NextRequest, NextResponse } from 'next/server';
import { proxyEmployees } from '@/lib/employees-proxy';

/** RIAC: la consulta del reporte (JSON paginado). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyEmployees(request, '/trainings/report');
}
