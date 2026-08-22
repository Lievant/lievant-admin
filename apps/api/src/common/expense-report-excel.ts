import ExcelJS from 'exceljs';

/**
 * Generador del Excel de los reportes de gastos (FIN-RE-07 reembolsos y
 * FIN-RE-06 tarjeta de crédito).
 *
 * El layout replica los formatos controlados del SGSI que viven en
 * `uploads/sgsi/.../Formatos/`: la primera columna (A) queda como margen
 * angosto, el bloque de encabezado ocupa las filas 1-8 con el título del SGSI
 * al centro y el recuadro de código/versión/fecha/clasificación a la derecha,
 * los datos de la carátula van en filas 12-14 y la tabla arranca en la fila 18.
 * Los dos formatos difieren en número de columnas, así que lo variable entra
 * por `ExcelReportSpec` y aquí solo vive lo común.
 */

export interface ExcelField {
  label: string;
  value: string;
}

export interface ExcelColumn {
  header: string;
  width: number;
  /** 'money' aplica formato $#,##0.00 y alineación derecha. */
  kind?: 'text' | 'money';
  /** Índice de la columna en el arreglo de totales; solo para las de dinero. */
  totalKey?: 'subtotal' | 'tip' | 'extras' | 'total';
}

export interface ExcelReportSpec {
  /** "Reporte de Gastos por reembolso" | "Reporte de Gastos" */
  title: string;
  documentCode: string;
  documentVersion: string;
  documentClassification: string;
  /** Columna izquierda de la carátula (etiqueta + valor). */
  leftFields: ExcelField[];
  /** Columna derecha de la carátula. */
  rightFields: ExcelField[];
  columns: ExcelColumn[];
  rows: (string | number)[][];
  totals: { subtotal: number; tip: number; extras: number; total: number };
  signatureLeft: { caption: string; name: string };
  signatureRight: { caption: string; name: string };
}

const NEGRO = 'FF000000';
const BLANCO = 'FFFFFFFF';
const GRIS_CLARO = 'FFF2F2F2';
const GRIS_BORDE = 'FFBFBFBF';
const MONEDA = '"$"#,##0.00';

const FILA_ENCABEZADO_TABLA = 18;

function borde(): Partial<ExcelJS.Borders> {
  const linea: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: GRIS_BORDE } };
  return { top: linea, left: linea, bottom: linea, right: linea };
}

export function buildExpenseReportWorkbook(spec: ExcelReportSpec): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Lievant Admin';
  wb.created = new Date();
  const ws = wb.addWorksheet('Gastos', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const totalCols = spec.columns.length;
  // A es el margen; los datos ocupan de B en adelante.
  const primeraCol = 2;
  const ultimaCol = primeraCol + totalCols - 1;

  ws.getColumn(1).width = 2.5;
  spec.columns.forEach((col, i) => {
    ws.getColumn(primeraCol + i).width = col.width;
  });

  // ── Encabezado ISO 27001 (filas 1-8) ──────────────────────────────────────
  // Sin logo: no hay un asset del isotipo dentro del bundle del API, así que el
  // recuadro izquierdo queda reservado con el nombre de la empresa.
  const colRecuadro = Math.max(primeraCol + 1, ultimaCol - 1);
  const logoFin = Math.max(primeraCol, colRecuadro - 5);

  ws.mergeCells(1, primeraCol, 8, logoFin);
  const celdaLogo = ws.getCell(1, primeraCol);
  celdaLogo.value = 'LIEVANT';
  celdaLogo.alignment = { vertical: 'middle', horizontal: 'center' };
  celdaLogo.font = { name: 'Calibri', size: 20, bold: true, color: { argb: NEGRO } };
  celdaLogo.border = borde();

  ws.mergeCells(1, logoFin + 1, 5, colRecuadro - 1);
  const celdaSgsi = ws.getCell(1, logoFin + 1);
  celdaSgsi.value = 'SISTEMA DE GESTION DE SEGURIDAD DE LA INFORMACIÓN';
  celdaSgsi.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  celdaSgsi.font = { name: 'Calibri', size: 12, bold: true };
  celdaSgsi.border = borde();

  ws.mergeCells(6, logoFin + 1, 8, colRecuadro - 1);
  const celdaTitulo = ws.getCell(6, logoFin + 1);
  celdaTitulo.value = spec.title;
  celdaTitulo.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  celdaTitulo.font = { name: 'Calibri', size: 14, bold: true };
  celdaTitulo.border = borde();

  const hoy = new Date();
  const fechaGeneracion = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
  const recuadro: [number, number, string][] = [
    [1, 2, `CÓDIGO: ${spec.documentCode}`],
    [3, 4, `VERSIÓN: ${spec.documentVersion}`],
    [5, 6, `FECHA: ${fechaGeneracion}`],
    [7, 8, `CLASIFICACIÓN: ${spec.documentClassification}`],
  ];
  for (const [desde, hasta, texto] of recuadro) {
    ws.mergeCells(desde, colRecuadro, hasta, ultimaCol);
    const celda = ws.getCell(desde, colRecuadro);
    celda.value = texto;
    celda.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    celda.font = { name: 'Calibri', size: 10 };
    celda.border = borde();
  }

  // ── Carátula: solicitante / tarjeta (filas 12-14) ─────────────────────────
  const colEtiquetaIzq = primeraCol;
  const colValorIzq = primeraCol + 2;
  const colEtiquetaDer = Math.max(colValorIzq + 2, ultimaCol - 2);
  const colValorDer = Math.min(colEtiquetaDer + 1, ultimaCol);

  const maxFilas = Math.max(spec.leftFields.length, spec.rightFields.length);
  for (let i = 0; i < maxFilas; i++) {
    const fila = 12 + i;
    const izq = spec.leftFields[i];
    const der = spec.rightFields[i];

    if (izq) {
      const etiqueta = ws.getCell(fila, colEtiquetaIzq);
      etiqueta.value = izq.label;
      etiqueta.font = { name: 'Calibri', size: 10, bold: true };
      const valor = ws.getCell(fila, colValorIzq);
      valor.value = izq.value;
      valor.font = { name: 'Calibri', size: 10 };
      valor.border = { bottom: { style: 'thin', color: { argb: GRIS_BORDE } } };
    }
    if (der) {
      const etiqueta = ws.getCell(fila, colEtiquetaDer);
      etiqueta.value = der.label;
      etiqueta.font = { name: 'Calibri', size: 10, bold: true };
      const valor = ws.getCell(fila, colValorDer);
      valor.value = der.value;
      valor.font = { name: 'Calibri', size: 10 };
      valor.border = { bottom: { style: 'thin', color: { argb: GRIS_BORDE } } };
    }
  }

  // ── Tabla de gastos ───────────────────────────────────────────────────────
  const filaHeader = ws.getRow(FILA_ENCABEZADO_TABLA);
  spec.columns.forEach((col, i) => {
    const celda = filaHeader.getCell(primeraCol + i);
    celda.value = col.header;
    celda.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BLANCO } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEGRO } };
    celda.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    celda.border = borde();
  });
  filaHeader.height = 28;

  let filaActual = FILA_ENCABEZADO_TABLA + 1;
  spec.rows.forEach((valores, indice) => {
    const fila = ws.getRow(filaActual);
    const alterna = indice % 2 === 1;

    spec.columns.forEach((col, i) => {
      const celda = fila.getCell(primeraCol + i);
      celda.value = valores[i] ?? '';
      celda.font = { name: 'Calibri', size: 10 };
      celda.border = borde();
      if (col.kind === 'money') {
        celda.numFmt = MONEDA;
        celda.alignment = { horizontal: 'right' };
      } else {
        celda.alignment = { vertical: 'top', wrapText: true };
      }
      if (alterna) {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_CLARO } };
      }
    });

    filaActual += 1;
  });

  // ── Fila de totales ───────────────────────────────────────────────────────
  const filaTotales = ws.getRow(filaActual);
  spec.columns.forEach((col, i) => {
    const celda = filaTotales.getCell(primeraCol + i);
    if (i === 0) {
      celda.value = 'TOTALES';
    } else if (col.totalKey) {
      celda.value = spec.totals[col.totalKey];
      celda.numFmt = MONEDA;
      celda.alignment = { horizontal: 'right' };
    } else {
      celda.value = '';
    }
    celda.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BLANCO } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEGRO } };
    celda.border = borde();
  });

  // ── Firmas ────────────────────────────────────────────────────────────────
  const filaFirmas = filaActual + 4;
  const mitad = primeraCol + Math.floor(totalCols / 2);

  const captionIzq = ws.getCell(filaFirmas, primeraCol);
  captionIzq.value = spec.signatureLeft.caption;
  captionIzq.font = { name: 'Calibri', size: 10, bold: true };

  const captionDer = ws.getCell(filaFirmas, mitad);
  captionDer.value = spec.signatureRight.caption;
  captionDer.font = { name: 'Calibri', size: 10, bold: true };

  const nombreIzq = ws.getCell(filaFirmas + 1, primeraCol);
  nombreIzq.value = spec.signatureLeft.name;
  nombreIzq.font = { name: 'Calibri', size: 10 };

  const nombreDer = ws.getCell(filaFirmas + 1, mitad);
  nombreDer.value = spec.signatureRight.name;
  nombreDer.font = { name: 'Calibri', size: 10 };

  for (const col of [primeraCol, mitad]) {
    const linea = ws.getCell(filaFirmas + 3, col);
    linea.value = '';
    linea.border = { top: { style: 'thin', color: { argb: NEGRO } } };
    ws.mergeCells(filaFirmas + 3, col, filaFirmas + 3, col + 2);
  }

  return wb;
}

/** DD/MMM/YYYY, p. ej. 15/jun/2026. */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatoFecha(valor: string | Date | null | undefined): string {
  if (!valor) return '';
  const iso = typeof valor === 'string' ? valor.slice(0, 10) : valor.toISOString().slice(0, 10);
  const [y, m, d] = iso.split('-');
  const mes = MESES[Number(m) - 1] ?? m;
  return `${d}/${mes}/${y}`;
}

/** Los DECIMAL de Postgres llegan como string; NaN se trata como cero. */
export function aNumero(valor: string | number | null | undefined): number {
  const n = typeof valor === 'number' ? valor : Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Nombre de archivo seguro: FIN-RE-07-FIN-RE-2026-014-julio-lara.xlsx */
export function nombreArchivo(codigo: string, numero: string | null, persona: string): string {
  const slug = (persona || 'reporte')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const partes = [codigo, numero ?? 'sin-numero', slug || 'reporte'];
  return `${partes.join('-')}.xlsx`;
}
