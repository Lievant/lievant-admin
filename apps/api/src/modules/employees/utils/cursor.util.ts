import { BadRequestException } from '@nestjs/common';

export interface CursorPayload {
  createdAt: string;
  id: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as CursorPayload;
    if (!decoded.createdAt || !decoded.id) {
      throw new Error('Invalid cursor');
    }
    return decoded;
  } catch {
    throw new BadRequestException('El cursor de paginación es inválido');
  }
}
