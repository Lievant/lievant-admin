import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type DocumentEntityKey = 'employees' | 'clients' | 'vendors';
export type DocStatus = 'complete' | 'incomplete' | 'no_required';
export type EntityFilter = 'all' | 'complete' | 'incomplete' | 'sin_docs' | 'en_proceso' | 'no_required';
export type StatusFilter = 'all' | 'active' | 'inactive';

export interface DocumentSummaryBlock {
  total: number;
  activos: number;
  inactivos: number;
  completos: number;
  incompletos: number;
  sinDocumentos: number;
  enProceso: number;
  sinRequeridos: number;
}

export interface DocumentSummary {
  empleados: DocumentSummaryBlock;
  clientes: DocumentSummaryBlock;
  proveedores: DocumentSummaryBlock;
}

export interface DocumentEntityRow {
  id: string;
  name: string;
  status: string;
  docStatus: DocStatus;
  totalDocs: number;
  requiredDocs: number;
  missingDocs: number;
  lastDocUploadedAt: string | null;
}

export interface DocumentEntityPage {
  items: DocumentEntityRow[];
  total: number;
  page: number;
  limit: number;
}

export interface DocumentActivityRow {
  date: string;
  entityName: string;
  documentType: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface DocumentActivityPage {
  items: DocumentActivityRow[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Cada entidad guarda sus documentos en su propio esquema y con nombres de
 * columna distintos, así que la configuración vive aquí y las consultas se
 * arman a partir de ella. Todo lo que se interpola son identificadores de esta
 * tabla —nunca entra texto del usuario—; los filtros van como parámetros.
 *
 * Ojo con dos asimetrías reales del modelo:
 *  - proveedores usa 'activo'/'inactivo' en español, empleados y clientes usan
 *    'active'/'inactive';
 *  - clients.documents no tiene borrado lógico, las otras dos sí.
 */
interface EntityConfig {
  table: string;
  join: string;
  nameExpr: string;
  activeValue: string;
  softDelete: boolean;
  docTable: string;
  docFk: string;
  docTypeCol: string;
  docDateCol: string;
  docSoftDelete: boolean;
  appliesTo: string;
}

const ENTITIES: Record<DocumentEntityKey, EntityConfig> = {
  employees: {
    table: 'employees.employee_records',
    join: '',
    nameExpr: 'e.full_name',
    activeValue: 'active',
    softDelete: true,
    docTable: 'employees.employee_documents',
    docFk: 'employee_id',
    docTypeCol: 'type',
    docDateCol: 'uploaded_at',
    docSoftDelete: true,
    appliesTo: 'employee',
  },
  clients: {
    table: 'clients.client_records',
    join: 'LEFT JOIN clients.companies co ON co.id = e.primary_company_id',
    nameExpr: 'COALESCE(co.name, e.display_id)',
    activeValue: 'active',
    softDelete: true,
    docTable: 'clients.documents',
    docFk: 'client_record_id',
    docTypeCol: 'document_type',
    docDateCol: 'created_at',
    docSoftDelete: false,
    appliesTo: 'client',
  },
  vendors: {
    table: 'vendors.vendors',
    join: '',
    nameExpr: 'e.name',
    activeValue: 'activo',
    softDelete: true,
    docTable: 'vendors.vendor_documents',
    docFk: 'vendor_id',
    docTypeCol: 'type',
    docDateCol: 'uploaded_at',
    docSoftDelete: true,
    appliesTo: 'vendor',
  },
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

@Injectable()
export class DocumentStatusService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getSummary(): Promise<DocumentSummary> {
    const [empleados, clientes, proveedores] = await Promise.all([
      this.getSummaryBlock('employees'),
      this.getSummaryBlock('clients'),
      this.getSummaryBlock('vendors'),
    ]);
    return { empleados, clientes, proveedores };
  }

  private async getSummaryBlock(key: DocumentEntityKey): Promise<DocumentSummaryBlock> {
    const cfg = ENTITIES[key];
    const sql = `
      ${this.baseCte(cfg)}
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = $2)::int AS activos,
        COUNT(*) FILTER (WHERE status IS DISTINCT FROM $2)::int AS inactivos,
        COUNT(*) FILTER (WHERE doc_status = 'complete')::int AS completos,
        COUNT(*) FILTER (WHERE doc_status = 'incomplete')::int AS incompletos,
        COUNT(*) FILTER (WHERE doc_status = 'incomplete' AND total_docs = 0)::int AS sin_documentos,
        COUNT(*) FILTER (WHERE doc_status = 'incomplete' AND total_docs > 0)::int AS en_proceso,
        COUNT(*) FILTER (WHERE doc_status = 'no_required')::int AS sin_requeridos
      FROM base
    `;
    const [row] = (await this.dataSource.query(sql, [cfg.appliesTo, cfg.activeValue])) as {
      total: number;
      activos: number;
      inactivos: number;
      completos: number;
      incompletos: number;
      sin_documentos: number;
      en_proceso: number;
      sin_requeridos: number;
    }[];

    return {
      total: row?.total ?? 0,
      activos: row?.activos ?? 0,
      inactivos: row?.inactivos ?? 0,
      completos: row?.completos ?? 0,
      incompletos: row?.incompletos ?? 0,
      sinDocumentos: row?.sin_documentos ?? 0,
      enProceso: row?.en_proceso ?? 0,
      sinRequeridos: row?.sin_requeridos ?? 0,
    };
  }

  async getEntities(params: {
    entity: DocumentEntityKey;
    page?: number;
    limit?: number;
    filter?: EntityFilter;
    status?: StatusFilter;
    search?: string;
  }): Promise<DocumentEntityPage> {
    const cfg = ENTITIES[params.entity];
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));
    const offset = (page - 1) * limit;

    // $1 es applies_to (lo usa el CTE); el resto se agrega solo si el filtro
    // correspondiente está activo. Postgres rechaza la consulta si se envían
    // más parámetros de los que el SQL referencia, así que no se puede reservar
    // un $2 "por si acaso".
    const args: unknown[] = [cfg.appliesTo];
    const where: string[] = [];

    const filtro = params.filter ?? 'all';
    if (filtro === 'complete') where.push(`doc_status = 'complete'`);
    if (filtro === 'incomplete') where.push(`doc_status = 'incomplete'`);
    if (filtro === 'no_required') where.push(`doc_status = 'no_required'`);
    if (filtro === 'sin_docs') where.push(`doc_status = 'incomplete' AND total_docs = 0`);
    if (filtro === 'en_proceso') where.push(`doc_status = 'incomplete' AND total_docs > 0`);

    const estado = params.status ?? 'all';
    if (estado === 'active') {
      args.push(cfg.activeValue);
      where.push(`status = $${args.length}`);
    }
    if (estado === 'inactive') {
      args.push(cfg.activeValue);
      where.push(`status IS DISTINCT FROM $${args.length}`);
    }

    if (params.search?.trim()) {
      args.push(`%${params.search.trim()}%`);
      where.push(`name ILIKE $${args.length}`);
    }

    const filtros = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRow] = (await this.dataSource.query(
      `${this.baseCte(cfg)} SELECT COUNT(*)::int AS total FROM base ${filtros}`,
      args,
    )) as { total: number }[];

    args.push(limit, offset);
    const rows = (await this.dataSource.query(
      `${this.baseCte(cfg)}
       SELECT id, name, status, doc_status, total_docs, required_docs, required_total, last_doc_uploaded_at
       FROM base
       ${filtros}
       ORDER BY name ASC
       LIMIT $${args.length - 1} OFFSET $${args.length}`,
      args,
    )) as {
      id: string;
      name: string;
      status: string;
      doc_status: DocStatus;
      total_docs: number;
      required_docs: number;
      required_total: number;
      last_doc_uploaded_at: Date | null;
    }[];

    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        docStatus: r.doc_status,
        totalDocs: r.total_docs,
        requiredDocs: r.required_total,
        missingDocs: Math.max(r.required_total - r.required_docs, 0),
        lastDocUploadedAt: r.last_doc_uploaded_at ? new Date(r.last_doc_uploaded_at).toISOString() : null,
      })),
      total: countRow?.total ?? 0,
      page,
      limit,
    };
  }

  async getActivity(params: {
    entity: DocumentEntityKey;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<DocumentActivityPage> {
    const cfg = ENTITIES[params.entity];
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));
    const offset = (page - 1) * limit;

    const args: unknown[] = [];
    const where: string[] = [];
    if (cfg.docSoftDelete) where.push('d.deleted_at IS NULL');
    if (cfg.softDelete) where.push('e.deleted_at IS NULL');

    if (params.dateFrom) {
      args.push(params.dateFrom);
      where.push(`d.${cfg.docDateCol} >= $${args.length}::date`);
    }
    if (params.dateTo) {
      args.push(params.dateTo);
      // El "hasta" es inclusivo: se compara contra el inicio del día siguiente.
      where.push(`d.${cfg.docDateCol} < ($${args.length}::date + INTERVAL '1 day')`);
    }

    const filtros = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const from = `
      FROM ${cfg.docTable} d
      INNER JOIN ${cfg.table} e ON e.id = d.${cfg.docFk}
      ${cfg.join}
      LEFT JOIN auth.users u ON u.id = d.uploaded_by
      ${filtros}
    `;

    const [countRow] = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS total ${from}`,
      args,
    )) as { total: number }[];

    args.push(limit, offset);
    const rows = (await this.dataSource.query(
      `SELECT
         d.${cfg.docDateCol} AS uploaded_at,
         ${cfg.nameExpr} AS entity_name,
         d.${cfg.docTypeCol} AS document_type,
         COALESCE(u.name, u.email, '—') AS uploaded_by
       ${from}
       ORDER BY d.${cfg.docDateCol} DESC
       LIMIT $${args.length - 1} OFFSET $${args.length}`,
      args,
    )) as {
      uploaded_at: Date;
      entity_name: string;
      document_type: string;
      uploaded_by: string;
    }[];

    return {
      items: rows.map((r) => {
        const iso = new Date(r.uploaded_at).toISOString();
        return {
          date: iso.slice(0, 10),
          entityName: r.entity_name,
          documentType: r.document_type,
          uploadedBy: r.uploaded_by,
          uploadedAt: iso,
        };
      }),
      total: countRow?.total ?? 0,
      page,
      limit,
    };
  }

  /**
   * CTE compartido por el dashboard y la lista. doc_status se calcula igual que
   * en los módulos de empleados, clientes y proveedores: sin obligatorios en el
   * catálogo es 'no_required', con todos los obligatorios subidos 'complete', y
   * cualquier otro caso 'incomplete'. Usa $1 = applies_to.
   */
  private baseCte(cfg: EntityConfig): string {
    const requeridos = `
      SELECT name FROM catalogs.document_types
      WHERE applies_to = $1 AND is_required = true AND is_active = true
    `;
    const docWhere = cfg.docSoftDelete ? 'WHERE deleted_at IS NULL' : '';
    const entityWhere = cfg.softDelete ? 'WHERE e.deleted_at IS NULL' : '';

    return `
      WITH req AS (SELECT COUNT(*)::int AS total FROM (${requeridos}) r),
      docs AS (
        SELECT
          ${cfg.docFk} AS entity_id,
          COUNT(*)::int AS total_docs,
          COUNT(DISTINCT ${cfg.docTypeCol}) FILTER (
            WHERE ${cfg.docTypeCol} IN (${requeridos})
          )::int AS required_docs,
          MAX(${cfg.docDateCol}) AS last_doc_uploaded_at
        FROM ${cfg.docTable}
        ${docWhere}
        GROUP BY ${cfg.docFk}
      ),
      base AS (
        SELECT
          e.id,
          ${cfg.nameExpr} AS name,
          e.status,
          COALESCE(d.total_docs, 0) AS total_docs,
          COALESCE(d.required_docs, 0) AS required_docs,
          req.total AS required_total,
          d.last_doc_uploaded_at,
          CASE
            WHEN req.total = 0 THEN 'no_required'
            WHEN COALESCE(d.required_docs, 0) >= req.total THEN 'complete'
            ELSE 'incomplete'
          END AS doc_status
        FROM ${cfg.table} e
        CROSS JOIN req
        ${cfg.join}
        LEFT JOIN docs d ON d.entity_id = e.id
        ${entityWhere}
      )
    `;
  }
}
