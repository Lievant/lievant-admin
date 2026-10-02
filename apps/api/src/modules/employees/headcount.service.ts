import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { userHasPermission } from '../auth/permissions.util';
import { EmployeeStatus } from './constants/employee-status.constant';
import {
  HEADCOUNT_COLUMNS,
  HEADCOUNT_DEFAULT_COLUMNS,
  HeadcountColumn,
} from './constants/headcount-columns.constant';
import { GetHeadcountDto } from './dto/get-headcount.dto';
import { EmployeeRecord } from './entities/employee-record.entity';

export interface HeadcountColumnInfo {
  key: string;
  label: string;
  sensitive: boolean;
  kind: 'text' | 'date' | 'money';
}

export type HeadcountRow = { employeeId: string } & Record<string, string | number | null>;

export interface HeadcountResult {
  generatedAt: string;
  total: number;
  filters: { empresa: string[]; activo: 'true' | 'false' | 'todos'; division: string | null; ubicacion: string | null };
  /** Columnas efectivamente devueltas (ya sin las sensibles si no hay permiso). */
  columns: HeadcountColumnInfo[];
  /** Columnas que este usuario puede elegir en el selector. */
  availableColumns: HeadcountColumnInfo[];
  canViewSensitive: boolean;
  rows: HeadcountRow[];
  options: { companies: string[]; divisions: string[]; locations: string[] };
}

const DEFAULT_COMPANY = 'LIEVANT';

const STATUS_LABEL: Record<string, string> = {
  [EmployeeStatus.ACTIVE]: 'Activo',
  [EmployeeStatus.INACTIVE]: 'Inactivo',
};

function columnInfo(c: HeadcountColumn): HeadcountColumnInfo {
  return { key: c.key, label: c.label, sensitive: !!c.sensitive, kind: c.kind ?? 'text' };
}

/**
 * Reporte de Headcount (confidencial). El acceso lo resuelve el guard con
 * rrhh.headcount.read; aquí solo se decide el alcance de columnas con
 * rrhh.headcount.sensitive.
 */
@Injectable()
export class HeadcountService {
  constructor(
    @InjectRepository(EmployeeRecord)
    private readonly employeesRepo: Repository<EmployeeRecord>,
  ) {}

  async getHeadcount(dto: GetHeadcountDto, user: User): Promise<HeadcountResult> {
    const canViewSensitive = userHasPermission(user, 'rrhh', 'headcount', 'sensitive');
    const allowed = HEADCOUNT_COLUMNS.filter((c) => canViewSensitive || !c.sensitive);

    const requested = dto.columns?.length ? dto.columns : HEADCOUNT_DEFAULT_COLUMNS;
    // Se respeta el orden del catálogo, no el de la query, para que la tabla y
    // el Excel salgan siempre con el mismo acomodo.
    let columns = allowed.filter((c) => requested.includes(c.key));
    if (columns.length === 0) {
      columns = allowed.filter((c) => HEADCOUNT_DEFAULT_COLUMNS.includes(c.key));
    }

    const empresa = dto.empresa?.length ? dto.empresa : [DEFAULT_COMPANY];
    const activo = dto.activo ?? 'true';
    const division = dto.division || null;
    const ubicacion = dto.ubicacion || null;

    const where: string[] = ['e.deleted_at IS NULL', 'e.company_code = ANY($1)'];
    const params: unknown[] = [empresa];
    if (activo !== 'todos') {
      params.push(activo === 'true' ? EmployeeStatus.ACTIVE : EmployeeStatus.INACTIVE);
      where.push(`e.status = $${params.length}`);
    }
    if (division) {
      params.push(division);
      where.push(`e.division = $${params.length}`);
    }
    if (ubicacion) {
      params.push(ubicacion);
      where.push(`e.location = $${params.length}`);
    }

    // Las expresiones vienen de HEADCOUNT_COLUMNS (lista blanca) y los alias
    // son índices, así que nada del cliente se interpola en el SQL.
    const select = columns.map((c, i) => `${c.sql} AS "c${i}"`).join(', ');
    const raw: Record<string, string | number | null>[] = await this.employeesRepo.query(
      `SELECT e.id AS "employeeId", ${select}
         FROM employees.employee_records e
         LEFT JOIN employees.personal_data pd ON pd.employee_id = e.id
         LEFT JOIN employees.compensation c ON c.employee_id = e.id
        WHERE ${where.join(' AND ')}
        ORDER BY e.full_name ASC`,
      params,
    );

    const rows: HeadcountRow[] = raw.map((r) => {
      const row: HeadcountRow = { employeeId: String(r.employeeId) };
      columns.forEach((c, i) => {
        const v = r[`c${i}`] ?? null;
        row[c.key] = c.key === 'status' && typeof v === 'string' ? (STATUS_LABEL[v] ?? v) : v;
      });
      return row;
    });

    const options = await this.getOptions(empresa);

    return {
      generatedAt: new Date().toISOString(),
      total: rows.length,
      filters: { empresa, activo, division, ubicacion },
      columns: columns.map(columnInfo),
      availableColumns: allowed.map(columnInfo),
      canViewSensitive,
      rows,
      options,
    };
  }

  async getHeadcountExcel(
    dto: GetHeadcountDto,
    user: User,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const data = await this.getHeadcount(dto, user);
    const fecha = data.generatedAt.slice(0, 10);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Lievant Admin';
    const ws = wb.addWorksheet('Headcount');
    const ncols = Math.max(data.columns.length, 1);

    // Fila 1: encabezado del reporte en una sola celda combinada.
    ws.mergeCells(1, 1, 1, ncols);
    const titulo = ws.getCell(1, 1);
    titulo.value = `Lievant Admin | Headcount | ${fecha} | Total: ${data.total} empleados`;
    titulo.font = { bold: true, size: 13 };

    ws.mergeCells(2, 1, 2, ncols);
    const filtros = ws.getCell(2, 1);
    const estado = { true: 'Activos', false: 'Inactivos', todos: 'Todos' }[data.filters.activo];
    filtros.value =
      `Empresa: ${data.filters.empresa.join(', ')} · Estado: ${estado}` +
      (data.filters.division ? ` · División: ${data.filters.division}` : '') +
      (data.filters.ubicacion ? ` · Ubicación: ${data.filters.ubicacion}` : '') +
      ' · CONFIDENCIAL';
    filtros.font = { italic: true, size: 9, color: { argb: 'FF666666' } };

    const HEADER_ROW = 4;
    const header = ws.getRow(HEADER_ROW);
    data.columns.forEach((c, i) => {
      const cell = header.getCell(i + 1);
      cell.value = c.label;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
      cell.alignment = { vertical: 'middle' };
    });

    data.rows.forEach((r, ri) => {
      const row = ws.getRow(HEADER_ROW + 1 + ri);
      data.columns.forEach((c, ci) => {
        const cell = row.getCell(ci + 1);
        const v = r[c.key];
        cell.value = v ?? '';
        if (c.kind === 'money' && typeof v === 'number') cell.numFmt = '"$"#,##0.00';
      });
    });

    // Fila de totales al pie: conteo en la primera columna y suma de las de dinero.
    const totalRow = ws.getRow(HEADER_ROW + 1 + data.rows.length);
    totalRow.getCell(1).value = `Total: ${data.total} empleados`;
    data.columns.forEach((c, ci) => {
      if (c.kind !== 'money' || ci === 0) return;
      const sum = data.rows.reduce((acc, r) => acc + (typeof r[c.key] === 'number' ? (r[c.key] as number) : 0), 0);
      const cell = totalRow.getCell(ci + 1);
      cell.value = sum;
      cell.numFmt = '"$"#,##0.00';
    });
    totalRow.font = { bold: true };
    totalRow.eachCell((cell) => {
      cell.border = { top: { style: 'thin' } };
    });

    // Autofit: ExcelJS no lo trae, se aproxima con el texto más largo de cada columna.
    data.columns.forEach((c, ci) => {
      let max = c.label.length;
      for (const r of data.rows) {
        const v = r[c.key];
        const len = v === null || v === undefined ? 0 : String(v).length + (c.kind === 'money' ? 4 : 0);
        if (len > max) max = len;
      }
      ws.getColumn(ci + 1).width = Math.min(Math.max(max + 2, 8), 60);
    });

    ws.views = [{ state: 'frozen', ySplit: HEADER_ROW }];

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const empresaSlug = data.filters.empresa.join('_').replace(/[^A-Za-z0-9_-]/g, '');
    return { buffer, fileName: `headcount-${fecha}-${empresaSlug || DEFAULT_COMPANY}.xlsx` };
  }

  /**
   * Opciones de los filtros. Empresas: todas; divisiones y ubicaciones: solo las
   * de las empresas seleccionadas, para que el select no ofrezca combinaciones vacías.
   */
  private async getOptions(empresa: string[]): Promise<HeadcountResult['options']> {
    const [companies, divisions, locations] = await Promise.all([
      this.employeesRepo.query(
        `SELECT DISTINCT company_code AS v FROM employees.employee_records
          WHERE deleted_at IS NULL ORDER BY 1`,
      ),
      this.employeesRepo.query(
        `SELECT DISTINCT division AS v FROM employees.employee_records
          WHERE deleted_at IS NULL AND division IS NOT NULL AND company_code = ANY($1) ORDER BY 1`,
        [empresa],
      ),
      this.employeesRepo.query(
        `SELECT DISTINCT location AS v FROM employees.employee_records
          WHERE deleted_at IS NULL AND location IS NOT NULL AND company_code = ANY($1) ORDER BY 1`,
        [empresa],
      ),
    ]);
    const pick = (rs: { v: string }[]) => rs.map((r) => r.v);
    return { companies: pick(companies), divisions: pick(divisions), locations: pick(locations) };
  }
}
