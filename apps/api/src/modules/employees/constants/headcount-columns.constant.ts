/**
 * Columnas del reporte de Headcount. `sql` es la expresión sobre
 * employee_records (e), personal_data (pd) y compensation (c); solo entra al
 * SELECT lo que esté en esta lista blanca, nunca texto del cliente.
 *
 * `id` muestra el folio (display_id): el UUID no le dice nada a RRHH y viaja
 * aparte como `employeeId` para el link al expediente.
 *
 * Las `sensitive` exigen además rrhh.headcount.sensitive; sin ese permiso se
 * descartan aunque se pidan.
 */
export interface HeadcountColumn {
  key: string;
  label: string;
  sql: string;
  sensitive?: boolean;
  kind?: 'text' | 'date' | 'money';
}

export const HEADCOUNT_COLUMNS: HeadcountColumn[] = [
  { key: 'id', label: 'ID', sql: 'e.display_id' },
  { key: 'full_name', label: 'Empleado', sql: 'e.full_name' },
  { key: 'company', label: 'Empresa', sql: 'e.company_name' },
  { key: 'area', label: 'División / Área', sql: 'e.area' },
  { key: 'position', label: 'Puesto', sql: 'e.position' },
  { key: 'division', label: 'División', sql: 'e.division' },
  { key: 'location', label: 'Ubicación', sql: 'e.location' },
  { key: 'status', label: 'Estado', sql: 'e.status' },
  { key: 'seniority_date', label: 'Fecha de Antigüedad', sql: 'e.seniority_date::text', kind: 'date' },
  { key: 'contract_type', label: 'Tipo de Contrato', sql: 'e.contract_type' },
  { key: 'corporate_email', label: 'Correo Corporativo', sql: 'e.corporate_email' },
  { key: 'direct_report_to', label: 'Jefe Inmediato', sql: 'e.direct_report_to' },
  { key: 'gender', label: 'Género', sql: 'e.gender' },
  { key: 'birth_date', label: 'Fecha de Nacimiento', sql: 'pd.birth_date::text', kind: 'date' },
  { key: 'phone', label: 'Teléfono', sql: 'pd.phone' },
  { key: 'curp', label: 'CURP', sql: 'pd.curp', sensitive: true },
  { key: 'rfc', label: 'RFC', sql: 'pd.rfc', sensitive: true },
  { key: 'imss', label: 'IMSS', sql: 'pd.imss_number', sensitive: true },
  {
    key: 'salary',
    label: 'Salario',
    sql: 'c.monthly_gross_salary::float8',
    sensitive: true,
    kind: 'money',
  },
];

export const HEADCOUNT_COLUMN_KEYS = HEADCOUNT_COLUMNS.map((c) => c.key);

export const HEADCOUNT_DEFAULT_COLUMNS = ['id', 'full_name', 'company', 'area', 'position'];
