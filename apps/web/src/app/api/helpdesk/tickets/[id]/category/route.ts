import { NextRequest, NextResponse } from 'next/server';
import { proxyHelpdesk } from '../../../proxy';

type Params = { params: Promise<{ id: string }> };

/** Body { category, subcategory? }. Solo TD; el API responde 403 a los demás. */
export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  return proxyHelpdesk(request, `/tickets/${encodeURIComponent(id)}/category`, 'PATCH');
}
