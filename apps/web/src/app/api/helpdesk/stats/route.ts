import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const from = request.nextUrl.searchParams.get('from') ?? '';
  const to = request.nextUrl.searchParams.get('to') ?? '';
  const qs = from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : '';
  try {
    const data = await apiFetch(`/helpdesk/tickets/stats${qs}`);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ total: 0, openTickets: 0, byStatus: {}, byPriority: {}, byCategory: {}, byMonth: [], top10Requesters: [], slaResolutionRate: null, avgResolutionHours: null, prev: null });
  }
}
