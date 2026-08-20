import { PENDIENTE } from './contract-template.util';
import type { GenerateContractDto } from './dto/contract.dto';

/**
 * Mapeo posicional de los huecos `[●]` de cada plantilla SGSI.
 *
 * Las plantillas no traen marcadores nombrados: todas las ocurrencias son la
 * misma cadena `[●]`, así que el único mapeo posible es por orden de aparición.
 * Este archivo es la fuente de verdad de ese orden, inferido leyendo el párrafo
 * que rodea cada hueco en los .docx reales.
 *
 * Reglas acordadas:
 *  - Los huecos del bloque de firmas van vacíos: se firman a mano tras imprimir.
 *  - Los huecos que no se pudieron identificar por contexto llevan `[COMPLETAR]`
 *    para que quien imprime vea que falta el dato.
 */

export type ContractType =
  | 'com-re-02'
  | 'com-re-04'
  | 'fin-re-02-moral'
  | 'fin-re-03-fisica';

export const CONTRACT_TEMPLATE_KEYS: Record<ContractType, string> = {
  'com-re-02': 'templates/clients/com-re-02-confidencialidad-persona-moral.docx',
  'com-re-04': 'templates/clients/com-re-04-confidencialidad-persona-fisica.docx',
  'fin-re-02-moral': 'templates/clients/fin-re-02-servicios-persona-moral.docx',
  'fin-re-03-fisica': 'templates/clients/fin-re-03-servicios-persona-fisica.docx',
};

export const CONTRACT_LABELS: Record<ContractType, string> = {
  'com-re-02': 'COM-RE-02',
  'com-re-04': 'COM-RE-04',
  'fin-re-02-moral': 'FIN-RE-02',
  'fin-re-03-fisica': 'FIN-RE-03',
};

/**
 * Ancla del párrafo del poder del representante en FIN-RE-02. Es el texto de la
 * nota que la propia plantilla incluye para indicar que ese párrafo se omite
 * cuando el poder consta en la escritura constitutiva.
 */
export const ANCLA_PARRAFO_PODER = 'en caso de ser la misma información se omite el siguiente parrafo';

/** Huecos del bloque de firmas: 12 al final de los contratos de servicios. */
const FIRMAS_VACIAS = Array.from({ length: 12 }, () => '');

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Descompone una fecha ISO (yyyy-mm-dd) en día, mes en letras y año 2 dígitos. */
export function partesFecha(iso: string): { dia: string; mes: string; anio2: string; anio: string } {
  const [anio = '', mes = '', dia = ''] = iso.split('-');
  const indiceMes = Number(mes) - 1;
  return {
    dia: String(Number(dia)),
    mes: MESES[indiceMes] ?? PENDIENTE,
    anio2: anio.slice(-2),
    anio,
  };
}

const vacioAPendiente = (v: string | undefined | null): string =>
  v !== undefined && v !== null && v.trim() !== '' ? v.trim() : PENDIENTE;

/** COM-RE-02 — confidencialidad, persona moral. 10 huecos. */
function valoresComRe02(dto: GenerateContractDto): string[] {
  const f = partesFecha(dto.fechaContrato);
  const razonSocial = vacioAPendiente(dto.razonSocial);
  const representante = vacioAPendiente(dto.representanteLegal);

  return [
    razonSocial,                        // 1  "LA SOCIEDAD DENOMINADA [●]"
    representante,                      // 2  "REPRESENTADA POR EL SEÑOR (A) [●]"
    PENDIENTE,                          // 3  sin identificar (escritura constitutiva?)
    vacioAPendiente(dto.domicilio),     // 4  "domicilio … ubicado en [●]"
    vacioAPendiente(dto.rfc),           // 5  "clave ante el RFC es [●]"
    f.dia,                              // 6
    f.mes,                              // 7
    f.anio2,                            // 8  va tras "202"
    razonSocial,                        // 9  tabla de firmas
    representante,                      // 10 tabla de firmas
  ];
}

/** COM-RE-04 — confidencialidad, persona física. 8 huecos. */
function valoresComRe04(dto: GenerateContractDto): string[] {
  const f = partesFecha(dto.fechaContrato);
  const nombre = vacioAPendiente(dto.nombreCliente);

  return [
    nombre,                             // 1  "LA OTRA PARTE EL C. [●]"
    nombre,                             // 2  "la persona física “[●]”"
    vacioAPendiente(dto.rfc),           // 3  RFC
    vacioAPendiente(dto.domicilio),     // 4  domicilio
    f.dia,                              // 5
    f.mes,                              // 6
    f.anio2,                            // 7
    nombre,                             // 8  firma
  ];
}

/**
 * Bloque común de los contratos de servicios: desde el servicio/objeto hasta la
 * fecha de ratificación. Idéntico en FIN-RE-02 y FIN-RE-03.
 */
function valoresServiciosComun(dto: GenerateContractDto): string[] {
  const inicio = dto.fechaInicio ? partesFecha(dto.fechaInicio) : null;
  const fin = dto.fechaFin ? partesFecha(dto.fechaFin) : null;
  const firma = partesFecha(dto.fechaFirma ?? dto.fechaContrato);
  const primerServicio = dto.servicios?.[0];

  return [
    vacioAPendiente(dto.colonia),                        // colonia
    vacioAPendiente(dto.codigoPostal),                   // código postal
    vacioAPendiente(dto.ciudad),                         // ciudad
    vacioAPendiente(dto.servicioObjeto),                 // "Servicio de [●]"
    vacioAPendiente(dto.canal1),                         // canal 1
    vacioAPendiente(dto.canal2),                         // canal 2
    PENDIENTE,                                           // hueco suelto sin identificar
    vacioAPendiente(dto.duracionMeses?.toString()),      // "será de [●] meses"
    inicio ? `${inicio.dia} de ${inicio.mes}` : PENDIENTE,
    fin ? `${fin.dia} de ${fin.mes}` : PENDIENTE,
    fin ? fin.anio2 : PENDIENTE,                         // año fin tras "202"
    vacioAPendiente(dto.servicioObjeto),                 // servicio (tiempo de entrega)
    vacioAPendiente(dto.montoTotal),                     // total en número
    vacioAPendiente(dto.montoTotalLetras),               // total en letras
    vacioAPendiente(primerServicio?.nombre),             // servicio (términos)
    vacioAPendiente(primerServicio?.monto),              // monto del servicio
    vacioAPendiente(primerServicio?.montoLetras),        // monto en letras
    vacioAPendiente(dto.pagoMensual),                    // pago mensual número
    vacioAPendiente(dto.pagoMensualLetras),              // pago mensual letras
    firma.dia,                                           // día ratificación
    firma.mes,                                           // mes ratificación
    firma.anio2,                                         // año ratificación
    ...FIRMAS_VACIAS,                                    // 12 huecos de firma
  ];
}

/** FIN-RE-02 — servicios, persona moral. 59 huecos (47 si se omite el poder). */
function valoresFinRe02(dto: GenerateContractDto): string[] {
  const f = partesFecha(dto.fechaContrato);
  const razonSocial = vacioAPendiente(dto.razonSocial);
  const representante = vacioAPendiente(dto.representanteLegal);
  const omitePoder = dto.poderEnEscrituraConstitutiva === true;

  /**
   * Huecos 14-21. Todos viven en el MISMO `<w:p>` de Word, verificado sobre la
   * plantilla: al omitir el poder se elimina el párrafo completo y con él los 8,
   * no solo los 6 del poder. Incluye la frase de "personalidad jurídica" y la de
   * "poderes no revocados" — ver la nota en el README de la desviación.
   */
  const bloquePoder = omitePoder
    ? [] // el párrafo se elimina antes de rellenar: estos 8 huecos ya no existen
    : [
        representante,                                // 14 "el C. [●]" personalidad jurídica
        PENDIENTE,                                    // 15 hueco dentro de la nota editorial
        vacioAPendiente(dto.poderEscrituraNumero),    // 16
        vacioAPendiente(dto.poderEscrituraFecha),     // 17
        vacioAPendiente(dto.poderNotarioNumero),      // 18
        vacioAPendiente(dto.poderNotarioNombre),      // 19
        vacioAPendiente(dto.poderCiudadNotario),      // 20
        representante,                                // 21 "declara y manifiesta el C. [●]"
      ];

  return [
    f.dia,                                            // 1
    f.mes,                                            // 2
    f.anio2,                                           // 3
    representante,                                     // 4
    razonSocial,                                       // 5
    vacioAPendiente(dto.escrituraNumero),              // 6
    vacioAPendiente(dto.escrituraFecha),               // 7
    vacioAPendiente(dto.notarioNumero),                // 8
    vacioAPendiente(dto.notarioNombre),                // 9
    vacioAPendiente(dto.ciudadNotario),                // 10
    vacioAPendiente(dto.ciudadRegistro),               // 11
    vacioAPendiente(dto.estadoRegistro),               // 12
    vacioAPendiente(dto.folioMercantil),               // 13
    ...bloquePoder,                                    // 14-21 (o ninguno si se omite)
    razonSocial,                                       // 22
    vacioAPendiente(dto.rfc),                          // 23
    ...valoresServiciosComun(dto),                     // 24-57
    representante,                                     // 58 firma
    razonSocial,                                       // 59 firma
  ];
}

/** FIN-RE-03 — servicios, persona física. 41 huecos. */
function valoresFinRe03(dto: GenerateContractDto): string[] {
  const f = partesFecha(dto.fechaContrato);
  const nombre = vacioAPendiente(dto.nombreCliente);

  return [
    f.dia,                                             // 1
    f.mes,                                             // 2
    f.anio2,                                            // 3
    nombre,                                             // 4
    nombre,                                             // 5
    vacioAPendiente(dto.rfc),                           // 6
    ...valoresServiciosComun(dto),                      // 7-40
    nombre,                                             // 41 firma
  ];
}

/** Huecos de guiones bajos, por posición, comunes a los dos contratos de servicios. */
export function valoresGuiones(tipo: ContractType, dto: GenerateContractDto): string[] {
  if (tipo === 'com-re-02' || tipo === 'com-re-04') return [];

  // Orden de aparición en la plantilla. Los que no son campos capturables se
  // dejan como están devolviendo undefined (la función de relleno los respeta).
  return [
    '', // cierre de comillas tras el nombre/razón social
    '', // cierre tras el RFC
    vacioAPendiente(dto.calle),                         // "calle ____"
    vacioAPendiente(dto.numeroExterior),                // "Número _____"
    '', // cierre tras la ciudad
    '', // "mil pesos" del total
    vacioAPendiente(dto.mesesServicio?.toString()),     // "Servicio por ___ meses"
    '', // "mil pesos" del servicio
    vacioAPendiente(dto.numeroPagos?.toString()),       // "pago en___ pagos mensuales"
    '', // cierre del monto mensual
    '', // "pesos 00/100"
  ];
}

export function valoresParaContrato(tipo: ContractType, dto: GenerateContractDto): string[] {
  switch (tipo) {
    case 'com-re-02':
      return valoresComRe02(dto);
    case 'com-re-04':
      return valoresComRe04(dto);
    case 'fin-re-02-moral':
      return valoresFinRe02(dto);
    case 'fin-re-03-fisica':
      return valoresFinRe03(dto);
  }
}
