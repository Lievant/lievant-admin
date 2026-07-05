import OpenAI from 'openai';

let client: OpenAI | null = null;

/**
 * Instanciación perezosa: si el constructor de OpenAI corriera al cargar el
 * módulo (como propiedad de clase) y faltara OPENAI_API_KEY, tumbaría el
 * arranque completo de Nest, no solo las rutas de ISOBOT.
 */
export function getOpenAI(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}
