import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

export async function GET(): Promise<NextResponse> {
  try {
    const data = await apiFetch('/helpdesk/assignees');
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}
