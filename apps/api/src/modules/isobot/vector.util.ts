/** pgvector espera literales tipo `[0.1,0.2,...]`; el driver `pg` serializa
 * arrays JS como `{0.1,0.2}` (formato array de Postgres), que pgvector no
 * acepta — por eso se arma el string a mano en vez de pasar el array crudo. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
