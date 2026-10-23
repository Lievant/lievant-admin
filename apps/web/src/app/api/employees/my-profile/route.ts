import { NextRequest, NextResponse } from 'next/server';
import { proxyEmployees } from '@/lib/employees-proxy';

/** Mi Información: el API deduce el expediente de la sesión; no se envía ningún id. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyEmployees(request, '/my-profile');
}
