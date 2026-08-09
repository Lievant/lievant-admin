import * as fs from 'fs';
import * as path from 'path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import JSZip from 'jszip';
import { DataSource, IsNull, Repository } from 'typeorm';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { EquipmentResponsiva } from './entities/equipment-responsiva.entity';
import { Equipment } from './entities/equipment.entity';

const RESPONSIVA_PREFIX = 'TIC-RE-02';
const DEFAULT_LIMIT = 20;

// El folio impreso en la plantilla que Transformación Digital mantiene.
//
// Word parte ese folio en tres runs ("TIC-RE-02", "-", "0114"), así que la
// cadena completa no existe en el XML y hay que sustituir el run del
// consecutivo por separado. Se conservan ambas formas: si alguien vuelve a
// escribir el folio de un tirón, la plantilla nueva seguirá funcionando.
const TEMPLATE_FOLIO = 'TIC-RE-02-0114';
const TEMPLATE_FOLIO_SEQ = '0114';

/**
 * La plantilla se resuelve relativa a este archivo. En desarrollo cuelga de
 * `src/`; en el contenedor, de `dist/`, porque nest-cli.json copia
 * `modules/**\/templates/*.docx` como asset. Se prueban ambas para que un
 * `ts-node` sobre src y el build compilado funcionen igual.
 */
const TEMPLATE_CANDIDATES = [
  path.join(__dirname, 'templates', 'carta-responsiva.docx'),
  path.join(process.cwd(), 'src', 'modules', 'inventory', 'templates', 'carta-responsiva.docx'),
  path.join(process.cwd(), 'apps', 'api', 'src', 'modules', 'inventory', 'templates', 'carta-responsiva.docx'),
];

export interface ResponsivaInfo {
  code: string;
  generatedAt: string | null;
}

export interface EmployeeEquipmentItem {
  id: string;
  displayId: string;
  equipmentType: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  status: string;
  assignmentDate: string | null;
}

export interface EmployeeDetail {
  employee: {
    id: string;
    displayId: string;
    fullName: string;
    area: string | null;
    position: string;
    corporateEmail: string | null;
    photoUrl: string | null;
    hireDate: string | null;
  };
  equipment: EmployeeEquipmentItem[];
  responsiva: ResponsivaInfo | null;
}

export interface EmployeeWithEquipmentItem {
  id: string;
  fullName: string;
  area: string | null;
  position: string;
  corporateEmail: string | null;
  photoUrl: string | null;
  equipmentCount: number;
  responsivaCode: string | null;
  hasResponsiva: boolean;
}

export interface EmployeesPage {
  data: EmployeeWithEquipmentItem[];
  nextCursor: string | null;
  total: number;
}

function fotoDe(correo: string | null): string | null {
  // Ruta del proxy del front, que resuelve la foto contra Microsoft 365. La
  // arma el backend para que las tres pantallas usen exactamente la misma.
  return correo ? `/api/users/${encodeURIComponent(correo)}/photo` : null;
}

function aIsoDate(valor: Date | string | null): string | null {
  if (!valor) return null;
  if (typeof valor === 'string') return valor.slice(0, 10);
  return valor.toISOString().slice(0, 10);
}

/** DD/MM/YYYY sin pasar por zona horaria: la fecha ya viene como date puro. */
function formatearFecha(iso: string | null): string {
  if (!iso) return '';
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  if (!anio || !mes || !dia) return '';
  return `${dia}/${mes}/${anio}`;
}

/** Escapa lo que se inyecta en el XML del .docx. */
function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function codificarCursor(nombre: string, id: string): string {
  return Buffer.from(`${nombre}|${id}`).toString('base64url');
}

function decodificarCursor(cursor: string): { nombre: string; id: string } {
  const [nombre = '', id = ''] = Buffer.from(cursor, 'base64url').toString().split('|');
  return { nombre, id };
}

@Injectable()
export class InventoryResponsivasService {
  constructor(
    @InjectRepository(Equipment) private readonly equipmentRepo: Repository<Equipment>,
    @InjectRepository(EmployeeRecord) private readonly employeesRepo: Repository<EmployeeRecord>,
    @InjectRepository(EquipmentResponsiva)
    private readonly responsivasRepo: Repository<EquipmentResponsiva>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Listado de colaboradores con equipo ────────────────────────────────────

  async listEmployeesWithEquipment(query: {
    search?: string;
    cursor?: string;
    limit?: number;
  }): Promise<EmployeesPage> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const condiciones: string[] = ['emp.deleted_at IS NULL'];
    const params: unknown[] = [];

    if (query.search) {
      params.push(`%${query.search}%`);
      condiciones.push(`(emp.full_name ILIKE $${params.length} OR emp.corporate_email ILIKE $${params.length})`);
    }

    // El orden es alfabético, no por fecha: es una lista de personas, y un
    // cursor sobre created_at dejaría la paginación en un orden sin sentido
    // para quien busca a alguien por nombre.
    const base = `
      FROM employees.employee_records emp
      JOIN LATERAL (
        SELECT COUNT(*)::int AS n
        FROM inventory.equipment e
        WHERE e.assigned_to_employee_id = emp.id AND e.deleted_at IS NULL
      ) eq ON eq.n > 0
      LEFT JOIN inventory.equipment_responsivas r ON r.employee_id = emp.id
      WHERE ${condiciones.join(' AND ')}
    `;

    const totales = (await this.employeesRepo.manager.query(
      `SELECT COUNT(*)::int AS total ${base}`,
      params,
    )) as Array<{ total: number }>;

    const condicionesPagina = [...condiciones];
    if (query.cursor) {
      const { nombre, id } = decodificarCursor(query.cursor);
      params.push(nombre, id);
      condicionesPagina.push(
        `(emp.full_name > $${params.length - 1} OR (emp.full_name = $${params.length - 1} AND emp.id > $${params.length}::uuid))`,
      );
    }

    params.push(limit + 1);
    const filas = (await this.employeesRepo.manager.query(
      `SELECT emp.id, emp.full_name, emp.area, emp.position, emp.corporate_email,
              eq.n AS equipment_count, r.code AS responsiva_code
       FROM employees.employee_records emp
       JOIN LATERAL (
         SELECT COUNT(*)::int AS n
         FROM inventory.equipment e
         WHERE e.assigned_to_employee_id = emp.id AND e.deleted_at IS NULL
       ) eq ON eq.n > 0
       LEFT JOIN inventory.equipment_responsivas r ON r.employee_id = emp.id
       WHERE ${condicionesPagina.join(' AND ')}
       ORDER BY emp.full_name ASC, emp.id ASC
       LIMIT $${params.length}`,
      params,
    )) as Array<Record<string, unknown>>;

    const hayMas = filas.length > limit;
    const pagina = hayMas ? filas.slice(0, limit) : filas;
    const ultima = pagina[pagina.length - 1];

    return {
      data: pagina.map((f) => {
        const correo = (f.corporate_email as string) ?? null;
        const code = (f.responsiva_code as string) ?? null;
        return {
          id: f.id as string,
          fullName: f.full_name as string,
          area: (f.area as string) ?? null,
          position: (f.position as string) ?? '',
          corporateEmail: correo,
          photoUrl: fotoDe(correo),
          equipmentCount: f.equipment_count as number,
          responsivaCode: code,
          hasResponsiva: code !== null,
        };
      }),
      nextCursor:
        hayMas && ultima
          ? codificarCursor(ultima.full_name as string, ultima.id as string)
          : null,
      total: totales[0]?.total ?? 0,
    };
  }

  // ── Detalle de un colaborador ──────────────────────────────────────────────

  async getEmployeeDetail(employeeId: string): Promise<EmployeeDetail> {
    const empleado = await this.employeesRepo.findOne({ where: { id: employeeId } });
    if (!empleado) throw new NotFoundException(`Empleado ${employeeId} no encontrado`);

    const equipos = await this.equipmentRepo.find({
      where: { assignedToEmployeeId: employeeId, deletedAt: IsNull() },
      order: { equipmentType: 'ASC', brand: 'ASC' },
    });

    const responsiva = await this.responsivasRepo.findOne({ where: { employeeId } });

    return {
      employee: {
        id: empleado.id,
        displayId: empleado.displayId,
        fullName: empleado.fullName,
        area: empleado.area,
        position: empleado.position,
        corporateEmail: empleado.corporateEmail,
        photoUrl: fotoDe(empleado.corporateEmail),
        // employee_records no tiene hire_date; seniority_date es la fecha de
        // ingreso que RRHH mantiene y la que va impresa en la responsiva.
        hireDate: aIsoDate(empleado.seniorityDate),
      },
      equipment: equipos.map((e) => ({
        id: e.id,
        displayId: e.displayId,
        equipmentType: e.equipmentType,
        brand: e.brand,
        model: e.model,
        serialNumber: e.serialNumber,
        status: e.status,
        assignmentDate: e.assignmentDate,
      })),
      responsiva: responsiva
        ? { code: responsiva.code, generatedAt: responsiva.generatedAt?.toISOString() ?? null }
        : null,
    };
  }

  // ── Generación del folio ───────────────────────────────────────────────────

  /**
   * Idempotente: si el colaborador ya tiene folio se devuelve el mismo. El
   * `nextval` va dentro de la transacción junto con el INSERT, y el índice
   * único por empleado ataja la carrera de dos clics simultáneos.
   */
  async generateResponsiva(
    employeeId: string,
    userId: string,
  ): Promise<{ code: string; employeeId: string; generatedAt: string | null; created: boolean }> {
    const empleado = await this.employeesRepo.findOne({ where: { id: employeeId } });
    if (!empleado) throw new NotFoundException(`Empleado ${employeeId} no encontrado`);

    const existente = await this.responsivasRepo.findOne({ where: { employeeId } });
    if (existente) {
      return {
        code: existente.code,
        employeeId,
        generatedAt: existente.generatedAt?.toISOString() ?? null,
        created: false,
      };
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const seq = (await manager.query(
          `SELECT nextval('inventory.responsiva_seq')::int AS n`,
        )) as Array<{ n: number }>;
        const consecutivo = seq[0]!.n;
        const code = `${RESPONSIVA_PREFIX}-${String(consecutivo).padStart(4, '0')}`;

        const filas = (await manager.query(
          `INSERT INTO inventory.equipment_responsivas (employee_id, code, generated_by)
           VALUES ($1, $2, $3)
           RETURNING code, generated_at`,
          [employeeId, code, userId],
        )) as Array<{ code: string; generated_at: Date }>;

        return {
          code: filas[0]!.code,
          employeeId,
          generatedAt: filas[0]!.generated_at?.toISOString() ?? null,
          created: true,
        };
      });
    } catch (error) {
      // Carrera perdida contra otro clic: el otro ya insertó, se devuelve el suyo.
      const ganador = await this.responsivasRepo.findOne({ where: { employeeId } });
      if (ganador) {
        return {
          code: ganador.code,
          employeeId,
          generatedAt: ganador.generatedAt?.toISOString() ?? null,
          created: false,
        };
      }
      throw error;
    }
  }

  // ── Documento ──────────────────────────────────────────────────────────────

  async buildResponsivaDocx(
    employeeId: string,
  ): Promise<{ buffer: Buffer; fileName: string; code: string }> {
    const detalle = await this.getEmployeeDetail(employeeId);
    const responsiva = detalle.responsiva;
    if (!responsiva) {
      throw new NotFoundException('El colaborador no tiene responsiva generada');
    }

    const plantilla = TEMPLATE_CANDIDATES.find((p) => fs.existsSync(p));
    if (!plantilla) {
      throw new NotFoundException(
        'No se encontró la plantilla carta-responsiva.docx en el servidor',
      );
    }

    const zip = await JSZip.loadAsync(fs.readFileSync(plantilla));
    const documento = zip.file('word/document.xml');
    if (!documento) throw new NotFoundException('La plantilla no tiene word/document.xml');

    let xml = await documento.async('string');

    // Los placeholders viven completos dentro de un solo <w:t>, así que un
    // reemplazo de texto plano basta y conserva todo el formato del documento.
    const sustituciones: Array<[string, string]> = [
      [TEMPLATE_FOLIO, responsiva.code],
      ['[nombre colaborador]', detalle.employee.fullName],
      ['[Nombre Colaborador]', detalle.employee.fullName],
      ['[fecha de ingreso]', formatearFecha(detalle.employee.hireDate)],
      ['[área/departamento]', detalle.employee.area ?? ''],
      ['[cargo]', detalle.employee.position ?? ''],
    ];

    for (const [buscado, valor] of sustituciones) {
      xml = xml.split(buscado).join(escaparXml(valor));
    }

    // El consecutivo en su propio run. Se acota a un <w:t> cuyo contenido sean
    // exactamente esos cuatro dígitos, para no tocar otro número del texto.
    const consecutivo = responsiva.code.slice(-4);
    xml = xml.replace(
      new RegExp(`(<w:t[^>]*>)${TEMPLATE_FOLIO_SEQ}(</w:t>)`, 'g'),
      `$1${consecutivo}$2`,
    );

    // createFolders: false — por defecto JSZip agrega una entrada de directorio
    // "word/" que la plantilla no trae. Word la tolera, pero el paquete deja de
    // ser byte a byte comparable con el original y algún validador OOXML
    // estricto podría rechazarlo.
    zip.file('word/document.xml', xml, { createFolders: false });
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    const nombreArchivo = `${responsiva.code} Carta Responsiva Equipo de Computo ${detalle.employee.fullName}.docx`;
    return { buffer, fileName: nombreArchivo, code: responsiva.code };
  }
}
