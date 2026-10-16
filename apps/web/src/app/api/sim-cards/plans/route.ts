import { NextRequest, NextResponse } from 'next/server';
import { proxySimCards } from '@/lib/sim-cards-proxy';

export function GET(request: NextRequest): Promise<NextResponse> {
  return proxySimCards(request, '/plans');
}

export function POST(request: NextRequest): Promise<NextResponse> {
  return proxySimCards(request, '/plans');
}
