import { NextRequest, NextResponse } from 'next/server';
import { proxyHr } from '@/lib/hr-proxy';

/** Parte del líder: el API verifica que la sesión sea de un líder y acota todo a su expediente. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyHr(request, '/job-requisitions/my');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyHr(request, '/job-requisitions/my');
}
