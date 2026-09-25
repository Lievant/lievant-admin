import { NextRequest, NextResponse } from 'next/server';
import { proxyPasswords } from '../proxy';

export function GET(request: NextRequest): Promise<NextResponse> {
  return proxyPasswords(request, '/is-manager');
}
