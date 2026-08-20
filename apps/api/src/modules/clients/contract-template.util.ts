/**
 * Relleno de plantillas SGSI de contratos de clientes.
 *
 * A diferencia de las plantillas de RRHH —que llevan marcadores nombrados
 * `{{VARIABLE}}` y se procesan con `docx-templates`— las plantillas de contratos
 * de clientes (COM-RE-02, COM-RE-04, FIN-RE-02, FIN-RE-03) traen el marcador
 * anónimo `[●]` repetido: todas las ocurrencias son la misma cadena, así que no
 * hay forma de distinguirlas por nombre. El relleno es necesariamente **por
 * posición**: la ocurrencia N recibe el valor N.
 *
 * Word además parte el texto en `runs`, y un mismo `[●]` puede quedar repartido
 * entre varios `<w:t>` (p. ej. `[` + `●]`). Por eso no sirve un replace sobre el
 * XML crudo: hay que trabajar sobre el texto concatenado de los `<w:t>` y mapear
 * cada carácter de vuelta a su nodo.
 */

export const MARCADOR = '[●]';

/** Marca los huecos que nadie supo mapear, para que se vean al imprimir. */
export const PENDIENTE = '[COMPLETAR]';

/**
 * Además de `[●]`, las plantillas traen huecos hechos con guiones bajos
 * (`calle ____ Número _____`, `Servicio por ___ meses`). Se rellenan igual, por
 * posición, con su propia lista de valores.
 */
const RE_GUIONES = /_{2,}/g;

interface NodoTexto {
  /** Índice de inicio del contenido dentro del XML original. */
  inicio: number;
  /** Índice de fin (exclusivo) del contenido dentro del XML original. */
  fin: number;
  /** Contenido textual, con las entidades XML todavía escapadas. */
  contenido: string;
}

const RE_NODO_TEXTO = /(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g;

function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function desescaparXml(valor: string): string {
  return valor
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Localiza los `<w:t>` del documento con sus posiciones en el XML. */
function extraerNodos(xml: string): NodoTexto[] {
  const nodos: NodoTexto[] = [];
  RE_NODO_TEXTO.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_NODO_TEXTO.exec(xml)) !== null) {
    const aperturaFin = m.index + m[1]!.length;
    nodos.push({
      inicio: aperturaFin,
      fin: aperturaFin + m[2]!.length,
      contenido: m[2]!,
    });
  }
  return nodos;
}

/**
 * Cuenta las ocurrencias de `[●]` en el texto visible del documento, tolerando
 * que el marcador esté partido entre runs.
 */
export function contarMarcadores(xml: string): number {
  const nodos = extraerNodos(xml);
  const texto = desescaparXml(nodos.map((n) => n.contenido).join(''));
  let total = 0;
  let i = 0;
  while ((i = texto.indexOf(MARCADOR, i)) !== -1) {
    total += 1;
    i += MARCADOR.length;
  }
  return total;
}

/**
 * Elimina por completo los `<w:p>` (párrafos) cuyo texto contenga `ancla`.
 *
 * Lo necesita FIN-RE-02: si el poder del representante consta en la misma
 * escritura constitutiva, el párrafo del poder no debe ir en el contrato — la
 * propia plantilla lo dice en una nota al margen. Se ejecuta **antes** de
 * rellenar, porque quitar el párrafo elimina también sus marcadores y con ello
 * cambia la numeración posicional del resto.
 */
export function eliminarParrafosCon(xml: string, ancla: string): { xml: string; eliminados: number } {
  const RE_PARRAFO = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  let eliminados = 0;

  const resultado = xml.replace(RE_PARRAFO, (parrafo) => {
    const texto = [...parrafo.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((m) => m[1])
      .join('');
    if (desescaparXml(texto).includes(ancla)) {
      eliminados += 1;
      return '';
    }
    return parrafo;
  });

  return { xml: resultado, eliminados };
}

/**
 * Rellena por posición los huecos de guiones bajos (`___`). Independiente de
 * `[●]`: tiene su propia numeración.
 */
export function rellenarGuiones(
  xml: string,
  valores: readonly string[],
): { xml: string; rellenados: number; totalHuecos: number } {
  let indice = 0;
  let rellenados = 0;

  const resultado = xml.replace(
    /(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g,
    (_todo, apertura: string, contenido: string, cierre: string) => {
      const nuevo = contenido.replace(RE_GUIONES, (guiones) => {
        const valor = valores[indice];
        indice += 1;
        if (valor === undefined) return guiones;
        rellenados += 1;
        return escaparXml(valor);
      });
      return apertura + nuevo + cierre;
    },
  );

  return { xml: resultado, rellenados, totalHuecos: indice };
}

/**
 * Sustituye cada `[●]` por el valor de `valores` en el mismo orden. Si hay más
 * marcadores que valores, los sobrantes se dejan intactos (no se borran: un
 * hueco visible en el documento es preferible a un borrado silencioso que nadie
 * detecta al revisar el contrato).
 *
 * Devuelve el XML resultante y cuántos marcadores se rellenaron.
 */
export function rellenarMarcadores(
  xml: string,
  valores: readonly string[],
): { xml: string; rellenados: number; totalMarcadores: number } {
  const nodos = extraerNodos(xml);

  // Mapa carácter -> nodo, sobre el texto desescapado de cada nodo.
  const piezas = nodos.map((n) => desescaparXml(n.contenido));
  const mapa: Array<{ nodo: number; offset: number }> = [];
  piezas.forEach((pieza, idxNodo) => {
    for (let k = 0; k < pieza.length; k++) mapa.push({ nodo: idxNodo, offset: k });
  });
  const texto = piezas.join('');

  // Posiciones de todos los marcadores.
  const posiciones: number[] = [];
  let i = 0;
  while ((i = texto.indexOf(MARCADOR, i)) !== -1) {
    posiciones.push(i);
    i += MARCADOR.length;
  }

  // Se edita cada nodo en memoria; al final se reconstruye el XML.
  const nuevas = [...piezas];
  let rellenados = 0;

  // De atrás hacia adelante para que los offsets previos sigan siendo válidos.
  for (let idx = posiciones.length - 1; idx >= 0; idx--) {
    const valor = valores[idx];
    if (valor === undefined) continue;

    const inicio = posiciones[idx]!;
    const celdas = [];
    for (let k = 0; k < MARCADOR.length; k++) celdas.push(mapa[inicio + k]!);

    // El valor entra completo en el primer nodo del marcador; en los demás se
    // borra el carácter que aportaban.
    const porNodo = new Map<number, number[]>();
    celdas.forEach((c) => {
      const lista = porNodo.get(c.nodo) ?? [];
      lista.push(c.offset);
      porNodo.set(c.nodo, lista);
    });

    const nodosOrdenados = [...porNodo.keys()].sort((a, b) => a - b);
    nodosOrdenados.forEach((nodo, pos) => {
      const offsets = porNodo.get(nodo)!.sort((a, b) => a - b);
      const desde = offsets[0]!;
      const hasta = offsets[offsets.length - 1]! + 1;
      const reemplazo = pos === 0 ? valor : '';
      nuevas[nodo] = nuevas[nodo]!.slice(0, desde) + reemplazo + nuevas[nodo]!.slice(hasta);
    });

    rellenados += 1;
  }

  // Reconstrucción: se reemplaza el contenido de cada nodo de atrás hacia
  // adelante para no invalidar los índices del XML original.
  let resultado = xml;
  for (let n = nodos.length - 1; n >= 0; n--) {
    if (nuevas[n] === piezas[n]) continue;
    const nodo = nodos[n]!;
    resultado =
      resultado.slice(0, nodo.inicio) + escaparXml(nuevas[n]!) + resultado.slice(nodo.fin);
  }

  return { xml: resultado, rellenados, totalMarcadores: posiciones.length };
}
