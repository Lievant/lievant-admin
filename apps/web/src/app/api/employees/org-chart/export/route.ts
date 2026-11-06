import { NextRequest, NextResponse } from 'next/server';
import { proxyEmployees } from '@/lib/employees-proxy';

/** Visto bueno de la exportación a PDF: exige rrhh.organigrama.export en el API y audita. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyEmployees(request, '/org-chart/export');
}
