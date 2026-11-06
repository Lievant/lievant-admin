import { NextRequest, NextResponse } from 'next/server';
import { proxyHr } from '@/lib/hr-proxy';

/** Buscador de empleados activos para «Reporta a»: el API exige update de la Matriz de Puestos. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyHr(request, '/job-positions/employee-search');
}
