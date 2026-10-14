import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Página mínima para el caso de error: el enlace se abre en una pestaña nueva y no debe verse JSON. */
function errorPage(status: number, message: string): NextResponse {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Documento no disponible</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#0f172a"><h1 style="font-size:1.25rem">No se pudo abrir el documento</h1><p style="color:#475569">${escapeHtml(message)}</p><p><a href="javascript:history.length>1?history.back():window.close()" style="color:#0f172a">Volver</a></p></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/**
 * Ver o descargar un documento de ISOBOT. Pide al API una URL prefirmada de
 * lectura (vida de 60 s) y redirige a ella: el enlace se abre en una pestaña
 * nueva sin bloqueo de ventanas emergentes y la URL nunca llega al HTML ni a la
 * interfaz. El permiso (sgsi.isobot.write) lo exige el API.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const disposition = request.nextUrl.searchParams.get('disposition') === 'inline' ? 'inline' : 'attachment';
  const token = request.cookies.get('access_token')?.value;

  let res: Response;
  try {
    res = await fetch(`${API_URL}/isobot/admin/documents/${id}/file?disposition=${disposition}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    });
  } catch {
    return errorPage(502, 'No se pudo contactar al servidor. Intenta de nuevo en unos minutos.');
  }

  if (res.ok) {
    const { url } = (await res.json()) as { url?: string };
    if (url) return NextResponse.redirect(url, 302);
    return errorPage(502, 'No se pudo generar el enlace del documento.');
  }

  if (res.status === 401 || res.status === 403) {
    return errorPage(res.status, 'No tienes permiso para ver los documentos del SGSI.');
  }
  if (res.status === 400 || res.status === 404) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    return errorPage(res.status, message ?? 'El documento no está disponible.');
  }
  return errorPage(502, 'No se pudo abrir el documento. Intenta de nuevo.');
}
