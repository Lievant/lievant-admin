import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
function rutaPlantilla(nombre: string): string | undefined {
  return [
    path.join(__dirname, 'templates', nombre),
    path.join(process.cwd(), 'src', 'modules', 'inventory', 'templates', nombre),
    path.join(process.cwd(), 'apps', 'api', 'src', 'modules', 'inventory', 'templates', nombre),
  ].find((p) => fs.existsSync(p));
}

// ── Bitácora TIC-RE-10 ───────────────────────────────────────────────────────

/**
 * Formato de las tres tablas del documento: la fila 0 es el encabezado, la 1
 * trae el ejemplo con datos y de la 2 en adelante van vacías para escribir a
 * mano. Se descarta la fila de ejemplo (son datos de otro colaborador) y se
 * conservan las vacías al final.
 */
const BITACORA_FILA_EJEMPLO = 1;
const BITACORA_TEXTO_FOLIO = 'Folio de la carta Responsiva';

// Formato de los runs de la tabla, copiado de la plantilla para que las filas
// generadas se vean igual que las escritas a mano.
const BITACORA_RPR =
  '<w:rPr><w:rFonts w:ascii="Aptos Narrow" w:eastAsia="Aptos Narrow" w:hAnsi="Aptos Narrow" w:cs="Aptos Narrow"/>' +
  '<w:color w:val="000000" w:themeColor="text1"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>';

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 13/abr/2026, el formato que ya usa la bitácora en papel. */
function formatearFechaBitacora(iso: string | null): string {
  if (!iso) return '';
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  if (!anio || !mes || !dia) return '';
  return `${dia}/${MESES_ES[Number(mes) - 1] ?? mes}/${anio}`;
}

function formatearPrecio(valor: string | number | null): string {
  const n = typeof valor === 'string' ? Number(valor) : (valor ?? 0);
  if (!Number.isFinite(n) || n === 0) return '';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface EquipoBitacora {
  esAlta: boolean;
  displayId: string;
  equipmentType: string;
  marcaModelo: string;
  serialNumber: string;
  observacion: string;
  precio: string;
  fecha: string;
}

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

    const plantilla = rutaPlantilla('carta-responsiva.docx');
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

  // ── Bitácora TIC-RE-10 ─────────────────────────────────────────────────────

  /**
   * Bitácora de asignación: el anexo de la responsiva donde se listan las altas
   * y bajas de equipo del colaborador.
   */
  async buildBitacoraDocx(
    employeeId: string,
  ): Promise<{ buffer: Buffer; fileName: string; code: string; filas: number }> {
    const empleado = await this.employeesRepo.findOne({ where: { id: employeeId } });
    if (!empleado) throw new NotFoundException(`Empleado ${employeeId} no encontrado`);

    const responsiva = await this.responsivasRepo.findOne({ where: { employeeId } });
    if (!responsiva) {
      throw new BadRequestException('El colaborador no tiene carta responsiva asignada');
    }

    const equipos = await this.equiposParaBitacora(employeeId);

    const plantilla = rutaPlantilla('bitacora-asignacion.docx');
    if (!plantilla) {
      throw new NotFoundException(
        'No se encontró la plantilla bitacora-asignacion.docx en el servidor',
      );
    }

    const zip = await JSZip.loadAsync(fs.readFileSync(plantilla));
    const documento = zip.file('word/document.xml');
    if (!documento) throw new NotFoundException('La plantilla no tiene word/document.xml');

    let xml = await documento.async('string');
    xml = this.sustituirFolioBitacora(xml, responsiva.code);
    xml = this.rellenarTablaBitacora(xml, equipos);

    zip.file('word/document.xml', xml, { createFolders: false });
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    const nombrePlano = empleado.fullName.replace(/\s+/g, '_');
    const fileName = `TIC-RE-10-${responsiva.code}-BITACORA-${nombrePlano}.docx`;
    return { buffer, fileName, code: responsiva.code, filas: equipos.length };
  }

  /**
   * Equipos que han pasado por el colaborador: los que tiene hoy (alta) y los
   * que tuvo y ya no (baja).
   *
   * inventory.equipment_history no tiene columna employee_id; las asignaciones
   * se registran con field_changed='assignedToEmployeeId' y el UUID del
   * empleado en new_value (alta) u old_value (baja), así que la búsqueda va por
   * ahí. Hoy la tabla está vacía, de modo que en la práctica solo salen altas.
   */
  private async equiposParaBitacora(employeeId: string): Promise<EquipoBitacora[]> {
    const filas = (await this.equipmentRepo.manager.query(
      `
      -- El mismo id va dos veces: $1 como uuid contra equipment y $2 como text
      -- contra equipment_history, donde old_value/new_value son TEXT. Con un
      -- solo parámetro Postgres unifica el tipo a uuid y la comparación con la
      -- columna de texto falla con "operator does not exist: text = uuid".
      SELECT e.display_id, e.equipment_type, e.brand, e.model, e.serial_number,
             e.operating_system, e.notes, e.purchase_value, e.assignment_date,
             (e.assigned_to_employee_id = $1 AND e.deleted_at IS NULL) AS es_alta,
             (SELECT MAX(h.created_at) FROM inventory.equipment_history h
              WHERE h.equipment_id = e.id
                AND h.field_changed = 'assignedToEmployeeId'
                AND h.old_value = $2) AS fecha_baja
      FROM inventory.equipment e
      WHERE (e.assigned_to_employee_id = $1 AND e.deleted_at IS NULL)
         OR EXISTS (
           SELECT 1 FROM inventory.equipment_history h
           WHERE h.equipment_id = e.id
             AND h.field_changed = 'assignedToEmployeeId'
             AND (h.new_value = $2 OR h.old_value = $2)
         )
      ORDER BY (e.assigned_to_employee_id = $1 AND e.deleted_at IS NULL) DESC,
               e.assignment_date ASC NULLS LAST, e.display_id ASC
      `,
      [employeeId, employeeId],
    )) as Array<Record<string, unknown>>;

    // Fecha real de entrega del equipo. Solo se cae a hoy cuando el registro no
    // tiene assignment_date, para no dejar la celda en blanco en un documento
    // que se firma.
    const hoy = formatearFechaBitacora(new Date().toISOString());

    return filas.map((f) => {
      const esAlta = Boolean(f.es_alta);
      const fechaBaja = f.fecha_baja ? aIsoDate(f.fecha_baja as Date) : null;
      return {
        esAlta,
        displayId: (f.display_id as string) ?? '',
        equipmentType: (f.equipment_type as string) ?? '',
        marcaModelo: [f.brand, f.model].filter(Boolean).join(' ').trim(),
        serialNumber: (f.serial_number as string) ?? '',
        // La plantilla usa esta columna para el sistema operativo (ej. "Win 11
        // Pro"); si el equipo no lo trae, se cae a las notas.
        observacion: ((f.operating_system as string) || (f.notes as string) || '').slice(0, 120),
        precio: formatearPrecio(f.purchase_value as string | null),
        fecha: esAlta
          ? formatearFechaBitacora(aIsoDate(f.assignment_date as string | null)) || hoy
          : formatearFechaBitacora(fechaBaja) || hoy,
      };
    });
  }

  /**
   * El folio del encabezado viene partido en runs ("TIC-RE-02-00" + "77"), así
   * que se reconstruye el párrafo completo: el código va en el primer <w:t> y
   * los demás quedan vacíos.
   */
  private sustituirFolioBitacora(xml: string, code: string): string {
    const parrafos = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
    const objetivo = parrafos.find((p) => this.textoDe(p).includes(BITACORA_TEXTO_FOLIO));
    if (!objetivo) return xml;

    let primero = true;
    const nuevo = objetivo.replace(/(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g, (_m, abre: string) => {
      if (primero) {
        primero = false;
        const apertura = abre.includes('xml:space') ? abre : '<w:t xml:space="preserve">';
        return `${apertura}${escaparXml(`${BITACORA_TEXTO_FOLIO} ${code}`)}</w:t>`;
      }
      return `${abre}</w:t>`;
    });

    return xml.replace(objetivo, nuevo);
  }

  /** Texto plano de un fragmento OOXML, solo de los <w:t> reales. */
  private textoDe(fragmento: string): string {
    const partes = fragmento.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g) ?? [];
    return partes
      .map((t) => t.replace(/<[^>]+>/g, ''))
      .join('')
      .replace(/&amp;/g, '&');
  }

  /**
   * Sustituye la fila de ejemplo por una fila por equipo, conservando las filas
   * vacías del final para que se pueda seguir escribiendo a mano.
   */
  private rellenarTablaBitacora(xml: string, equipos: EquipoBitacora[]): string {
    const tabla = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/);
    if (!tabla) return xml;

    const filas = tabla[0].match(/<w:tr[\s>][\s\S]*?<\/w:tr>/g) ?? [];
    const ejemplo = filas[BITACORA_FILA_EJEMPLO];
    if (!ejemplo) return xml;

    // Los <w:tcPr> de la fila de ejemplo llevan el ancho de cada columna; se
    // reutilizan para que las filas generadas no descuadren la tabla.
    const celdasEjemplo = ejemplo.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? [];
    const props = celdasEjemplo.map((c) => c.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/)?.[0] ?? '');
    const trAbre = ejemplo.match(/^<w:tr[^>]*>/)?.[0] ?? '<w:tr>';

    const construir = (valores: string[]): string => {
      const celdas = valores.map((valor, i) => {
        const contenido = valor
          ? `<w:r>${BITACORA_RPR}<w:t xml:space="preserve">${escaparXml(valor)}</w:t></w:r>`
          : '';
        return `<w:tc>${props[i] ?? ''}<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${contenido}</w:p></w:tc>`;
      });
      return `${trAbre}${celdas.join('')}</w:tr>`;
    };

    const nuevas = equipos.map((e) =>
      construir([
        e.esAlta ? 'X' : '',
        e.esAlta ? '' : 'X',
        e.displayId,
        e.equipmentType,
        e.marcaModelo,
        e.serialNumber,
        e.observacion,
        e.precio,
        e.fecha,
        '', // FIRMA EMPLEADO: se firma a mano
      ]),
    );

    // La fila de ejemplo se reemplaza; el encabezado y las vacías se conservan.
    const tablaNueva = tabla[0].replace(ejemplo, nuevas.join(''));
    return xml.replace(tabla[0], tablaNueva);
  }
}
