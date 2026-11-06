import { NextRequest, NextResponse } from 'next/server';
import { proxyHr } from '@/lib/hr-proxy';

type Ctx = { params: Promise<{ id: string }> };

/** Copia los OKRs activos de un semestre a otro (el API valida permiso y el tope de 100). */
export async function POST(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  return proxyHr(request, `/job-positions/${encodeURIComponent((await params).id)}/okrs/copy`);
}
