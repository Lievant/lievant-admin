import { NextRequest, NextResponse } from 'next/server';
import { proxyEmployees } from '@/lib/employees-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> },
): Promise<NextResponse> {
  return proxyEmployees(request, `/my-profile/documents/${encodeURIComponent((await params).docId)}/download-url`);
}
