import ExcelJS from 'exceljs';
import { LIEVANT_LOGO_HEIGHT, LIEVANT_LOGO_PNG_BASE64, LIEVANT_LOGO_WIDTH } from '../../common/lievant-logo';
import { formatGeneratedAtMx } from '../employees/trainings-report-excel';
import type { ReportSummary } from './okr-evaluations.util';

export const OKR_REPORT_TITLE = 'Reporte de Evaluación de OKRs';
export const DETAIL_SHEET = 'Detalle';
export const SUMMARY_SHEET = 'Resumen';
export const DETAIL_COLUMNS = [
  'Colaborador',
  'Área',
  'Líder Directo',
  'Periodo',
  'Objetivo',
  'Resultado Clave',
  'Peso',
  'Calificación',
  'Estado',
  'Fecha de Evaluación',
] as const;

const HEADER_ROW = 7;
const NEGRO = 'FF000000';
const BLANCO = 'FFFFFFFF';
const GRIS = 'FF666666';

export interface OkrDetailRow {
  employeeName: string;
  area: string | null;
  leaderName: string | null;
  period: string;
  objective: string;
  keyResult: string;
  weight: number | null;
  score: number | null;
  status: 'pendiente' | 'completada';
  evaluatedAt: Date | null;
}

export interface OkrWorkbookInput {
  rows: OkrDetailRow[];
  summary: ReportSummary;
  periodLabel: string;
  filtersText: string;
  generatedAt: Date;
}

/** Fecha UTC → celda de fecha (dd/mm/aaaa) en hora de México. */
function mxDate(d: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return new Date(Date.UTC(g('year'), g('month') - 1, g('day')));
}

export function okrDetailRow(r: OkrDetailRow): (string | number | Date)[] {
  return [
    r.employeeName,
    r.area ?? '',
    r.leaderName ?? '',
    r.period,
    r.objective,
    r.keyResult,
    r.weight ?? '',
    r.score ?? '',
    r.status === 'completada' ? 'Evaluado' : 'Pendiente',
    r.evaluatedAt ? mxDate(r.evaluatedAt) : '',
  ];
}

const avg = (n: number | null): number | string => (n === null ? '—' : n);

function styleHeader(row: ExcelJS.Row, count: number): void {
  for (let c = 1; c <= count; c++) {
    const cell = row.getCell(c);
    cell.font = { name: 'Calibri', bold: true, color: { argb: BLANCO } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEGRO } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }
  row.height = 22;
}

/** Encabezado común de las dos hojas: logo, nombre del reporte, periodo, filtros y generación (hora de México). */
function writeHeader(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, ncols: number, input: OkrWorkbookInput, totalLabel: string): void {
  const logo = wb.addImage({ base64: LIEVANT_LOGO_PNG_BASE64, extension: 'png' });
  const h = 62;
  ws.addImage(logo, { tl: { col: 0.1, row: 0.15 }, ext: { width: Math.round((h * LIEVANT_LOGO_WIDTH) / LIEVANT_LOGO_HEIGHT), height: h } });
  for (let r = 1; r <= 4; r++) ws.getRow(r).height = 18;
  const line = (row: number, text: string, font: Partial<ExcelJS.Font>) => {
    ws.mergeCells(row, 2, row, ncols);
    const cell = ws.getCell(row, 2);
    cell.value = text;
    cell.font = font;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  };
  line(1, OKR_REPORT_TITLE, { name: 'Calibri', size: 14, bold: true });
  line(2, `Periodo: ${input.periodLabel}`, { name: 'Calibri', size: 10, bold: true });
  line(3, `Filtros: ${input.filtersText}`, { name: 'Calibri', size: 9, italic: true, color: { argb: GRIS } });
  line(4, `Generado: ${formatGeneratedAtMx(input.generatedAt)} (America/Mexico_City)`, { name: 'Calibri', size: 9, italic: true, color: { argb: GRIS } });
  ws.mergeCells(5, 1, 5, ncols);
  ws.getCell(5, 1).value = totalLabel;
  ws.getCell(5, 1).font = { name: 'Calibri', size: 10, bold: true };
}

/** Dos hojas: "Detalle" (tabla completa con encabezado fijo y autofiltro) y "Resumen" (general, por colaborador, por área y por periodo). */
export function buildOkrWorkbook(input: OkrWorkbookInput): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Lievant Admin';
  wb.created = input.generatedAt;

  // ── Detalle ────────────────────────────────────────────────────────────────
  const ws = wb.addWorksheet(DETAIL_SHEET, { views: [{ state: 'frozen', ySplit: HEADER_ROW }] });
  const ncols = DETAIL_COLUMNS.length;
  const rows = input.rows.map(okrDetailRow);
  DETAIL_COLUMNS.forEach((header, ci) => {
    let max = header.length;
    for (const r of rows) {
      const v = r[ci];
      const len = v instanceof Date ? 10 : String(v ?? '').length;
      if (len > max) max = len;
    }
    ws.getColumn(ci + 1).width = Math.min(Math.max(max + 2, ci === 0 ? 16 : 10), 60);
  });
  writeHeader(wb, ws, ncols, input, `Total de OKRs: ${input.rows.length}`);
  const header = ws.getRow(HEADER_ROW);
  DETAIL_COLUMNS.forEach((label, ci) => (header.getCell(ci + 1).value = label));
  styleHeader(header, ncols);
  rows.forEach((values, ri) => {
    const row = ws.getRow(HEADER_ROW + 1 + ri);
    values.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'top', horizontal: v instanceof Date || typeof v === 'number' || ci === 8 ? 'center' : 'left' };
      if (v instanceof Date) cell.numFmt = 'dd/mm/yyyy';
    });
  });
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: ncols } };

  // ── Resumen ────────────────────────────────────────────────────────────────
  const sm = wb.addWorksheet(SUMMARY_SHEET);
  const s = input.summary;
  sm.getColumn(1).width = 34;
  [2, 3, 4, 5, 6].forEach((c) => (sm.getColumn(c).width = 16));
  writeHeader(wb, sm, 6, input, 'Promedios sobre todo el conjunto filtrado');

  let r = HEADER_ROW;
  const section = (title: string, heads: string[], body: (string | number)[][]) => {
    sm.getCell(r, 1).value = title;
    sm.getCell(r, 1).font = { name: 'Calibri', size: 11, bold: true };
    r += 1;
    heads.forEach((h, i) => (sm.getRow(r).getCell(i + 1).value = h));
    styleHeader(sm.getRow(r), heads.length);
    r += 1;
    for (const values of body) {
      values.forEach((v, i) => {
        const cell = sm.getRow(r).getCell(i + 1);
        cell.value = v;
        cell.font = { name: 'Calibri', size: 10 };
        if (typeof v === 'number') cell.alignment = { horizontal: 'center' };
      });
      r += 1;
    }
    r += 1;
  };
  section('General', ['Indicador', 'Valor'], [
    ['OKRs asignados', s.assigned],
    ['OKRs evaluados', s.evaluated],
    ['Promedio general', avg(s.average)],
  ]);
  section('Por colaborador', ['Colaborador', 'Área', 'Periodo', 'Promedio', 'Evaluados', 'Asignados'], s.byEmployee.map((e) => [e.employeeName, e.area ?? '', e.period, avg(e.average), e.evaluated, e.assigned]));
  section('Por área', ['Área', 'Periodo', 'Promedio', 'Colaboradores con promedio'], s.byArea.map((a) => [a.area ?? 'Sin área', a.period, avg(a.average), a.employees]));
  section('Por periodo', ['Periodo', 'Promedio', 'Colaboradores con promedio'], s.byPeriod.map((p) => [p.period, avg(p.average), p.employees]));
  return wb;
}
