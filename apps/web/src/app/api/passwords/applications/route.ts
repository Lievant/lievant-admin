import { NextRequest, NextResponse } from 'next/server';
import { proxyPasswords } from '../proxy';

export function GET(request: NextRequest): Promise<NextResponse> {
  return proxyPasswords(request, '/applications');
}

export function POST(request: NextRequest): Promise<NextResponse> {
  return proxyPasswords(request, '/applications', 'POST');
}
