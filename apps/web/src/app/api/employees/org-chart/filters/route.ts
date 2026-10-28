import { NextRequest, NextResponse } from 'next/server';
import { proxyEmployees } from '@/lib/employees-proxy';

/** Opciones de los filtros del organigrama: cualquier usuario autenticado; el API valida la sesión. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyEmployees(request, '/org-chart/filters');
}
