/**
 * Seed: Maestro de Licencias desde CSV
 *
 * Lee uploads/Maestro_de_Licencias_Lievant.csv y crea/actualiza:
 *   - licenses.employee_licenses (active_directory_name, responsiva)
 *   - licenses.tool_assignments  (has_access por herramienta)
 *
 * Empareja empleados por corporate_email (columna "Usuario" del CSV).
 * Idempotente: upsert por employee_id / (employee_license_id, tool_id).
 *
 * Ejecutar:
 *   npm run seed:licenses       (desde apps/api/)
 *
 * Prerequisito: colocar el archivo en
 *   <repo-root>/uploads/Maestro_de_Licencias_Lievant.csv
 */

import * as fs from 'fs';
import * as path from 'path';
import AppDataSource from '../data-source';
import { EmployeeRecord } from '../../modules/employees/entities/employee-record.entity';
import { EmployeeLicense } from '../../modules/licenses/entities/employee-license.entity';
import { ToolAssignment } from '../../modules/licenses/entities/tool-assignment.entity';
import { ToolCatalog } from '../../modules/licenses/entities/tool-catalog.entity';

const CSV_PATH = path.resolve(process.cwd(), '../../uploads/Maestro_de_Licencias_Lievant.csv');

// Columna del CSV → nombre en licenses.tool_catalog
const TOOL_COLUMN_MAP: Record<string, string> = {
  'Correo': 'Correo',
  'MS Basic': 'MS Basic',
  'MS Premium + Teams': 'MS Premium + Teams',
  'Aplicaciones de MS 365': 'Aplicaciones MS 365',
  'MS Copilot': 'MS Copilot',
  'CRM': 'CRM',
  'COR': 'COR',
  'Lapzo': 'Lapzo',
  'Eversign': 'Eversign',
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function toBool(val: string | undefined): boolean {
  return (val ?? '').trim() === 'Verdadero';
}

function toNullable(val: string | undefined): string | null {
  const s = (val ?? '').trim();
  if (!s || s === 'N/A') return null;
  return s;
}

async function run(): Promise<void> {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`\n❌  Archivo no encontrado: ${CSV_PATH}`);
    console.error('   Coloca el CSV en la carpeta uploads/ del repo antes de ejecutar este seed.\n');
    process.exit(1);
  }

  await AppDataSource.initialize();

  const employeesRepo = AppDataSource.getRepository(EmployeeRecord);
  const licensesRepo = AppDataSource.getRepository(EmployeeLicense);
  const assignmentsRepo = AppDataSource.getRepository(ToolAssignment);
  const toolsRepo = AppDataSource.getRepository(ToolCatalog);

  const tools = await toolsRepo.find();
  const toolByName = new Map(tools.map((t) => [t.name, t]));

  const rawLines = fs.readFileSync(CSV_PATH, 'utf-8').split(/\r?\n/).filter((l) => l.trim() !== '');
  // Línea 0: metadata (ListSchema=...) → saltar
  // Línea 1: encabezados
  const headers = parseCsvLine(rawLines[1]!).map((h) => h.trim());
  const dataLines = rawLines.slice(2);

  const idx = {
    usuario: headers.indexOf('Usuario'),
    activeDirectory: headers.indexOf('Active Directory'),
    responsiva: headers.indexOf('Responsiva'),
  };

  const toolColumnIndexes = Object.keys(TOOL_COLUMN_MAP).map((col) => ({
    csvColumn: col,
    toolName: TOOL_COLUMN_MAP[col]!,
    columnIndex: headers.indexOf(col),
  }));

  let found = 0;
  let notFound = 0;
  const notFoundEmails: string[] = [];

  console.log(`\nProcesando ${CSV_PATH}...\n`);

  for (const line of dataLines) {
    const fields = parseCsvLine(line);
    const email = fields[idx.usuario]?.trim();
    if (!email) continue;

    const employee = await employeesRepo.findOne({ where: { corporateEmail: email } });
    if (!employee) {
      notFound++;
      notFoundEmails.push(email);
      continue;
    }
    found++;

    const activeDirectoryName = toNullable(fields[idx.activeDirectory]);
    const responsiva = toNullable(fields[idx.responsiva]);

    let license = await licensesRepo.findOne({ where: { employeeId: employee.id } });
    if (license) {
      license.activeDirectoryName = activeDirectoryName;
      license.responsiva = responsiva;
    } else {
      license = licensesRepo.create({
        employeeId: employee.id,
        activeDirectoryName,
        responsiva,
      });
    }
    license = await licensesRepo.save(license);

    for (const { toolName, columnIndex } of toolColumnIndexes) {
      const tool = toolByName.get(toolName);
      if (!tool || columnIndex === -1) continue;

      const hasAccess = toBool(fields[columnIndex]);
      const existing = await assignmentsRepo.findOne({
        where: { employeeLicenseId: license.id, toolId: tool.id },
      });

      if (existing) {
        existing.hasAccess = hasAccess;
        if (hasAccess && !existing.grantedAt) existing.grantedAt = new Date();
        await assignmentsRepo.save(existing);
      } else {
        await assignmentsRepo.save(
          assignmentsRepo.create({
            employeeLicenseId: license.id,
            toolId: tool.id,
            hasAccess,
            isAdmin: false,
            grantedAt: hasAccess ? new Date() : null,
          }),
        );
      }
    }

    console.log(`  ✓  ${employee.fullName} <${email}>`);
  }

  console.log(`\n─────────────────────────────────────────────`);
  console.log(`  Encontrados    : ${found}`);
  console.log(`  No encontrados : ${notFound}`);
  if (notFoundEmails.length) {
    console.log(`\n  Emails no encontrados:`);
    for (const email of notFoundEmails) console.log(`    - ${email}`);
  }
  console.log(`─────────────────────────────────────────────\n`);

  await AppDataSource.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
