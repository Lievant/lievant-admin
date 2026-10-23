import ExcelJS from 'exceljs';
import { LIEVANT_LOGO_HEIGHT, LIEVANT_LOGO_PNG_BASE64, LIEVANT_LOGO_WIDTH } from '../../common/lievant-logo';
import { RIAC_LEVEL_LABELS, RIAC_TYPE_LABELS, formatRiacDay, type RiacItem, type RiacType } from './trainings-report.util';

export const RIAC_REPORT_TITLE = 'Registro Individual de Administración de Competencias';
export const RIAC_COLUMNS = [
  'ID Empleado',
  'Nombre',
  'Área',
  'Cargo',
  'Curso / Certificado',
  'Institución',
  'Tipo',
  'Nivel',
  'Fecha de Inicio',
  'Fecha de Fin',
  'Duración',
  'Reconocimiento',
] as const;

const HEADER_ROW = 7;
const NEGRO = 'FF000000';
const BLANCO = 'FFFFFFFF';
const GRIS = 'FF666666';

/** 'dd/mm/aaaa hh:mm:ss' en America/Mexico_City. */
export function formatGeneratedAtMx(date: Date): string {
  const parts = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('day')}/${get('month')}/${get('year')} ${hour}:${get('minute')}:${get('second')}`;
}

/** Fila de datos en el orden de RIAC_COLUMNS. Las fechas van como Date UTC para dar formato dd/mm/aaaa. */
export function riacExcelRow(i: RiacItem): (string | Date)[] {
  const day = (v: string | null): Date | string => {
    if (!v) return '';
    const [y, m, d] = v.split('-').map(Number) as [number, number, number];
    return new Date(Date.UTC(y, m - 1, d));
  };
  return [
    i.employeeDisplayId,
    i.employeeName,
    i.area ?? '',
    i.position,
    i.name,
    i.institution,
    RIAC_TYPE_LABELS[i.developmentType as RiacType] ?? i.developmentType,
    i.level ? RIAC_LEVEL_LABELS[i.level] ?? i.level : '',
    day(i.startDate),
    i.endDate ? day(i.endDate) : 'En Curso',
    i.duration,
    i.isCompanyRecognition ? 'Sí' : 'No',
  ];
}

export interface RiacWorkbookInput {
  items: RiacItem[];
  from: string;
  to: string;
  filtersText: string;
  generatedAt: Date;
}

/** Una sola hoja: encabezado (logo, nombre, periodo, filtros, generación) y la tabla completa. */
export function buildRiacWorkbook(input: RiacWorkbookInput): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Lievant Admin';
  wb.created = input.generatedAt;
  const ws = wb.addWorksheet('RIAC', { views: [{ state: 'frozen', ySplit: HEADER_ROW }] });
  const ncols = RIAC_COLUMNS.length;

  const rows = input.items.map(riacExcelRow);

  // Ancho automático según el contenido (con tope), calculado sobre el texto visible.
  RIAC_COLUMNS.forEach((header, ci) => {
    let max = header.length;
    for (const r of rows) {
      const v = r[ci];
      const len = v instanceof Date ? 10 : String(v ?? '').length;
      if (len > max) max = len;
    }
    ws.getColumn(ci + 1).width = Math.min(Math.max(max + 2, ci === 0 ? 16 : 10), 60);
  });

  // Encabezado del reporte (filas 1-5), con el logo anclado a la izquierda.
  const logo = wb.addImage({ base64: LIEVANT_LOGO_PNG_BASE64, extension: 'png' });
  const logoHeight = 62;
  ws.addImage(logo, {
    tl: { col: 0.1, row: 0.15 },
    ext: { width: Math.round((logoHeight * LIEVANT_LOGO_WIDTH) / LIEVANT_LOGO_HEIGHT), height: logoHeight },
  });
  for (let r = 1; r <= 4; r++) ws.getRow(r).height = 18;

  const line = (row: number, text: string, font: Partial<ExcelJS.Font>) => {
    ws.mergeCells(row, 2, row, ncols);
    const cell = ws.getCell(row, 2);
    cell.value = text;
    cell.font = font;
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
  };
  line(1, RIAC_REPORT_TITLE, { name: 'Calibri', size: 14, bold: true });
  line(2, `Periodo: ${formatRiacDay(input.from)} al ${formatRiacDay(input.to)}`, { name: 'Calibri', size: 10, bold: true });
  line(3, `Filtros: ${input.filtersText}`, { name: 'Calibri', size: 9, italic: true, color: { argb: GRIS } });
  line(4, `Generado: ${formatGeneratedAtMx(input.generatedAt)} (America/Mexico_City)`, {
    name: 'Calibri',
    size: 9,
    italic: true,
    color: { argb: GRIS },
  });
  ws.mergeCells(5, 1, 5, ncols);
  ws.getCell(5, 1).value = `Total de registros: ${input.items.length}`;
  ws.getCell(5, 1).font = { name: 'Calibri', size: 10, bold: true };

  // Encabezados de la tabla con estilo.
  const header = ws.getRow(HEADER_ROW);
  RIAC_COLUMNS.forEach((label, ci) => {
    const cell = header.getCell(ci + 1);
    cell.value = label;
    cell.font = { name: 'Calibri', bold: true, color: { argb: BLANCO } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEGRO } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  header.height = 22;

  rows.forEach((values, ri) => {
    const row = ws.getRow(HEADER_ROW + 1 + ri);
    values.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'top', horizontal: v instanceof Date || ci === 11 ? 'center' : 'left' };
      if (v instanceof Date) cell.numFmt = 'dd/mm/yyyy';
    });
  });

  // Filtros de Excel sobre la fila de encabezados.
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: ncols } };
  return wb;
}
