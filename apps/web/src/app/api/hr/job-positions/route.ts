import { NextRequest, NextResponse } from 'next/server';
import { proxyHr } from '@/lib/hr-proxy';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyHr(request, '/job-positions');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyHr(request, '/job-positions');
}
