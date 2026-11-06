import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import ExcelJS from 'exceljs';
import { AuditService } from '../../audit/audit.service';
import { cellText } from '../../job-positions/job-positions-import.service';
import { CatalogCompetency } from '../entities/catalog-competency.entity';
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  parseCompetenciesSheets,
  type ImportIssue,
  type ParsedCompetency,
  type RawSheet,
} from './competencies-import.parser';
import { nameKey } from './competencies.util';

export interface Actor {
  id?: string | null;
  email?: string | null;
  name?: string | null;
}

export type ImportAction = 'crear' | 'actualizar' | 'sin cambios' | 'restaurar';

export interface ImportRow {
  row: number;
  name: string;
  description: string | null;
  order: number;
  action: ImportAction;
}

export interface ImportResult {
  mode: 'preview' | 'apply';
  applied: boolean;
  fileName: string;
  sheet: string | null;
  summary: { create: number; update: number; unchanged: number; restore: number; errors: number; warnings: number };
  rows: ImportRow[];
  warnings: ImportIssue[];
  errors: ImportIssue[];
}

interface Plan {
  parsed: ParsedCompetency;
  action: ImportAction;
  /** La competencia existente (viva o eliminada) que se actualiza o restaura. */
  existing: CatalogCompetency | null;
  description: string | null;
  order: number;
}

/**
 * Importación de competencias desde Excel. `preview` solo lee; `apply` escribe todo en una transacción (todo o nada).
 * El archivo se vuelve a leer en cada llamada: no hay estado en el servidor. El «ID» del Excel nunca se guarda como
 * id de la base: solo sirve de orden cuando el archivo no trae «Orden».
 */
@Injectable()
export class CompetenciesImportService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** Valida el archivo (firma ZIP, tamaño) y lo convierte en filas de texto por hoja. */
  async readWorkbook(file: { buffer: Buffer; originalname: string; size: number } | undefined): Promise<RawSheet[]> {
    if (!file || !file.buffer || file.buffer.length === 0) throw new BadRequestException('No se recibió ningún archivo o está vacío.');
    if (file.buffer.length > MAX_IMPORT_BYTES) throw new BadRequestException('El archivo pasa de 5 MB.');
    if (!/\.xlsx$/i.test(file.originalname) || file.buffer.subarray(0, 4).toString('hex') !== '504b0304') {
      throw new BadRequestException('El archivo debe ser un Excel .xlsx.');
    }
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('No se pudo leer el archivo: no es un Excel .xlsx válido.');
    }
    const sheets: RawSheet[] = wb.worksheets.map((ws) => {
      const rows: string[][] = [];
      ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          cells[col - 1] = cellText(cell.value);
        });
        rows[rowNumber - 1] = Array.from(cells, (c) => c ?? '');
      });
      return { name: ws.name, rows: Array.from(rows, (r) => r ?? []) };
    });
    return sheets;
  }

  async run(
    mode: 'preview' | 'apply',
    file: { buffer: Buffer; originalname: string; size: number } | undefined,
    actor: Actor,
  ): Promise<ImportResult> {
    const sheets = await this.readWorkbook(file);
    const parsed = parseCompetenciesSheets(sheets);
    if (parsed.dataRows > MAX_IMPORT_ROWS) throw new BadRequestException(`El archivo pasa del límite de ${MAX_IMPORT_ROWS} filas.`);
    const fileName = file?.originalname ?? '';
    if (parsed.errors.length > 0) return this.result(mode, false, fileName, parsed.sheetName, [], [], parsed.errors);

    if (mode === 'preview') {
      const { plans, warnings } = await this.plan(this.dataSource.manager, parsed.rows);
      return this.result(mode, false, fileName, parsed.sheetName, plans, warnings, []);
    }

    // Todo o nada: si algo falla al escribir, la transacción se revierte completa.
    const { plans, warnings } = await this.dataSource.transaction(async (m) => {
      const planned = await this.plan(m, parsed.rows);
      const repo = m.getRepository(CatalogCompetency);
      for (const p of planned.plans) {
        if (p.action === 'sin cambios') continue;
        if (p.action === 'crear') {
          await repo.save(repo.create({ name: p.parsed.name, description: p.description, sortOrder: p.order, isActive: true }));
        } else {
          const e = p.existing!;
          if (p.action === 'restaurar') {
            e.deletedAt = null;
            e.isActive = true;
          }
          e.description = p.description;
          e.sortOrder = p.order;
          await repo.save(e);
        }
      }
      return planned;
    });
    const result = this.result(mode, true, fileName, parsed.sheetName, plans, warnings, []);
    await this.audit.logActivity({
      userId: actor.id ?? null,
      userEmail: actor.email ?? null,
      userName: actor.name ?? null,
      action: 'import',
      module: 'catalogos',
      entityType: 'competency_import',
      entityName: fileName,
      changes: {
        fileName: { from: null, to: fileName },
        created: { from: null, to: result.summary.create },
        updated: { from: null, to: result.summary.update },
        restored: { from: null, to: result.summary.restore },
        unchanged: { from: null, to: result.summary.unchanged },
      },
    });
    return result;
  }

  /** Qué haría la importación con cada fila (compara por nombre normalizado; las que no vienen en el archivo no se tocan). */
  private async plan(manager: EntityManager, rows: ParsedCompetency[]): Promise<{ plans: Plan[]; warnings: ImportIssue[] }> {
    const all = await manager.getRepository(CatalogCompetency).find({ withDeleted: true });
    const alive = new Map<string, CatalogCompetency>();
    const deleted = new Map<string, CatalogCompetency>();
    for (const c of all) {
      const key = nameKey(c.name);
      if (!c.deletedAt) alive.set(key, c);
      else {
        // Si hay varias eliminadas con el mismo nombre se restaura la más reciente.
        const prev = deleted.get(key);
        if (!prev || (prev.deletedAt as Date) < c.deletedAt) deleted.set(key, c);
      }
    }
    const plans: Plan[] = [];
    const warnings: ImportIssue[] = [];
    for (const p of rows) {
      const live = alive.get(p.key);
      const dead = live ? undefined : deleted.get(p.key);
      const existing = live ?? dead ?? null;
      const order = p.order ?? existing?.sortOrder ?? p.position;
      const description = p.description ?? existing?.description ?? null;
      let action: ImportAction;
      if (!existing) action = 'crear';
      else if (dead) action = 'restaurar';
      else action = description !== (existing.description ?? null) || order !== existing.sortOrder ? 'actualizar' : 'sin cambios';
      if (dead) warnings.push({ row: p.row, message: `Se restauró la competencia eliminada «${dead.name}».` });
      if (live && live.name !== p.name) {
        warnings.push({
          row: p.row,
          message: `«${p.name}» ya existe como «${live.name}» (solo cambian mayúsculas, acentos o espacios): se tratará como actualización.`,
        });
      }
      plans.push({ parsed: p, action, existing, description, order });
    }
    return { plans, warnings };
  }

  private result(
    mode: 'preview' | 'apply',
    applied: boolean,
    fileName: string,
    sheet: string | null,
    plans: Plan[],
    warnings: ImportIssue[],
    errors: ImportIssue[],
  ): ImportResult {
    const count = (a: ImportAction): number => plans.filter((p) => p.action === a).length;
    return {
      mode,
      applied,
      fileName,
      sheet,
      summary: {
        create: count('crear'),
        update: count('actualizar'),
        unchanged: count('sin cambios'),
        restore: count('restaurar'),
        errors: errors.length,
        warnings: warnings.length,
      },
      rows: plans.map((p) => ({ row: p.parsed.row, name: p.parsed.name, description: p.description, order: p.order, action: p.action })),
      warnings,
      errors,
    };
  }
}
