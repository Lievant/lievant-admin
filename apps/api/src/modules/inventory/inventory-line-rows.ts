import { QueryEquipmentDto } from './dto/query-equipment.dto';

/** Tipo con el que las líneas telefónicas sin equipo aparecen como filas del Inventario. */
export const LINE_ROW_TYPE = 'Línea Telefónica';

const MS_EXPR = "date_trunc('milliseconds', s.created_at)";

/**
 * ¿Entran filas de líneas sin equipo en esta consulta? Solo para quien puede
 * leer líneas (lo decide quien llama) y solo si los filtros activos tienen
 * sentido para una línea:
 *
 * - Tipo: solo "Línea Telefónica" (aísla las líneas) o ninguno. Cualquier otro
 *   tipo de equipo las excluye.
 * - "Sin línea telefónica" las excluye; "Con línea" las incluye.
 * - Marca y Estatus de equipo no tienen equivalente claro en una línea: con uno
 *   de esos filtros activo, las líneas quedan fuera.
 * - Área y Ubicación sí aplican, contra los datos del empleado que se muestran
 *   en la fila; persona asignada, contra el empleado de la línea.
 */
export function lineRowPlan(query: QueryEquipmentDto): { includeLines: boolean; onlyLines: boolean } {
  const onlyLines = query.equipmentType === LINE_ROW_TYPE;
  const typeAllows = !query.equipmentType || onlyLines;
  const includeLines = typeAllows && query.simLine !== 'sin' && !query.brand && !query.status;
  return { includeLines, onlyLines: includeLines && onlyLines };
}

/**
 * SELECT de claves de las líneas sin equipo (id, tipo de fila y marca de
 * tiempo) para unir con las claves de los equipos. Los parámetros llevan el
 * desplazamiento `offset` porque comparten numeración ($n) con la consulta de
 * equipos. Siempre excluye bajas lógicas.
 */
export function buildLineKeysSelect(query: QueryEquipmentDto, offset: number): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const add = (value: unknown): string => {
    params.push(value);
    return `$${offset + params.length}`;
  };
  const where = ['s.deleted_at IS NULL', 's.equipment_id IS NULL'];

  if (query.assignedToEmployeeId) where.push(`s.employee_id = ${add(query.assignedToEmployeeId)}`);
  if (query.area) where.push(`emp.area = ${add(query.area)}`);
  if (query.location) where.push(`emp.location = ${add(query.location)}`);
  if (query.search) {
    const p = add(`%${query.search}%`);
    where.push(
      `(s.sim_code ILIKE ${p} OR s.phone_number ILIKE ${p} OR p.name ILIKE ${p} OR v.name ILIKE ${p} OR emp.full_name ILIKE ${p} OR emp.corporate_email ILIKE ${p})`,
    );
  }

  const sql = `
    SELECT s.id AS id, 'line' AS kind, ${MS_EXPR} AS ts
    FROM inventory.sim_cards s
    JOIN inventory.sim_plans p ON p.id = s.plan_id
    LEFT JOIN vendors.vendors v ON v.id = p.vendor_id
    LEFT JOIN employees.employee_records emp ON emp.id = s.employee_id
    WHERE ${where.join(' AND ')}`;
  return { sql, params };
}

/** Datos de pantalla de las líneas de una página. Nunca incluye el ICCID. */
export const LINE_ROWS_SQL = `
  SELECT s.id, s.sim_code, s.phone_number, s.status, s.created_at,
         p.name AS plan_name, v.name AS provider_name,
         s.employee_id, emp.full_name AS employee_name, emp.corporate_email AS employee_email,
         emp.area AS employee_area, emp.location AS employee_location
  FROM inventory.sim_cards s
  JOIN inventory.sim_plans p ON p.id = s.plan_id
  LEFT JOIN vendors.vendors v ON v.id = p.vendor_id
  LEFT JOIN employees.employee_records emp ON emp.id = s.employee_id
  WHERE s.deleted_at IS NULL AND s.id = ANY($1::uuid[])
`;

export interface LineRowRaw {
  id: string;
  sim_code: string;
  phone_number: string;
  status: string;
  created_at: Date | string;
  plan_name: string;
  provider_name: string | null;
  employee_id: string | null;
  employee_name: string | null;
  employee_email: string | null;
  employee_area: string | null;
  employee_location: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  activa: 'Activa',
  suspendida: 'Suspendida',
  cancelada: 'Cancelada',
};

/**
 * Fila de línea para la tabla de Inventario. Comparte los campos planos con las
 * filas de equipo (displayId, equipmentType, brand, model, area, location,
 * status, simCardCount…) para que el orden y la tabla no tengan casos
 * especiales, y agrega `rowKind: 'line'` y `line` con sus datos propios.
 * Las filas de equipo conservan exactamente su forma y no llevan `rowKind`.
 */
export function toLineRow(r: LineRowRaw) {
  return {
    rowKind: 'line' as const,
    id: r.id,
    displayId: r.sim_code,
    legacyId: null,
    equipmentType: LINE_ROW_TYPE,
    brand: r.provider_name,
    model: r.plan_name,
    assignedToEmployeeId: r.employee_id,
    assignedEmployeeName: r.employee_name,
    assignedEmployeeEmail: r.employee_email,
    area: r.employee_area,
    location: r.employee_location,
    status: STATUS_LABEL[r.status] ?? r.status,
    simCardCount: 1,
    simCardPhones: [r.phone_number],
    createdAt: new Date(r.created_at).toISOString(),
    line: {
      simCode: r.sim_code,
      phoneNumber: r.phone_number,
      providerName: r.provider_name,
      planName: r.plan_name,
      status: r.status,
    },
  };
}

export type LineRow = ReturnType<typeof toLineRow>;
