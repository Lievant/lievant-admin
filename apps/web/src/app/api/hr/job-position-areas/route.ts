import { NextRequest, NextResponse } from 'next/server';
import { proxyHr } from '@/lib/hr-proxy';

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyHr(request, '/job-position-areas');
}
