import { NextRequest, NextResponse } from 'next/server';
import { proxyPasswords } from '../proxy';

/** Personas visibles para el selector: la propia y sus subordinados directos activos (id y nombre). */
export function GET(request: NextRequest): Promise<NextResponse> {
  return proxyPasswords(request, '/visible-people');
}
