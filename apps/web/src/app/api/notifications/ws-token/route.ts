import { NextRequest, NextResponse } from 'next/server';

/**
 * Entrega al navegador el access token para autenticar el socket.
 *
 * El WebSocket no puede apoyarse en la cookie: `access_token` es httpOnly (JS no
 * la lee) y está acotada al host del frontend, así que en producción no viaja al
 * dominio de la API. socket.io necesita el token en el handshake.
 *
 * Contrapartida: el token queda accesible desde JS durante la sesión, lo que
 * debilita en parte la protección de httpOnly frente a un XSS. Se acepta porque
 * la alternativa —mandar el userId a pelo, como se planteó— permitiría a
 * cualquiera escuchar las notificaciones de otro usuario. Endurecerlo más
 * requeriría emitir en la API un token efímero exclusivo para el socket.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const accessToken = request.cookies.get('access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ token: null }, { status: 401 });
  }

  return NextResponse.json(
    { token: accessToken },
    // Sin caché: es material de sesión y no debe quedar en intermediarios.
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
