import { NextRequest, NextResponse } from 'next/server';
import { proxyPasswords } from '../proxy';

/** ?q= — colaboradores activos para elegir el destino de una transferencia (id, nombre, cargo y área). */
export function GET(request: NextRequest): Promise<NextResponse> {
  return proxyPasswords(request, '/transfer-candidates');
}
