import { NextRequest, NextResponse } from 'next/server';
import { proxyEmployees } from '@/lib/employees-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trainingId: string }> },
): Promise<NextResponse> {
  return proxyEmployees(
    request,
    `/my-profile/trainings/${encodeURIComponent((await params).trainingId)}/certificate-url`,
  );
}
