import { NextRequest, NextResponse } from 'next/server';
import { proxyEmployees } from '@/lib/employees-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; trainingId: string }> },
): Promise<NextResponse> {
  const { id, trainingId } = await params;
  return proxyEmployees(
    request,
    `/${encodeURIComponent(id)}/trainings/${encodeURIComponent(trainingId)}/certificate-url`,
  );
}
