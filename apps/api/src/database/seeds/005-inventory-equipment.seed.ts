/**
 * Seed: Inventario histórico de equipos tecnológicos
 *
 * Lee uploads/Inventario_de_Equipos_de_Computo.csv (exportación SharePoint)
 * y carga inventory.equipment.
 *
 * - Primera línea del CSV = schema SharePoint (ignorada)
 * - Segunda línea = headers
 * - Líneas 3+ = datos
 *
 * Idempotente: omite filas cuyo legacy_id ya existe en la BD.
 *
 * Ejecutar desde apps/api/:
 *   npm run seed:inventory
 */

import * as fs from 'fs';
import * as path from 'path';
import AppDataSource from '../data-source';
import { Equipment } from '../../modules/inventory/entities/equipment.entity';
import { EmployeeRecord } from '../../modules/employees/entities/employee-record.entity';

// ── Ruta al CSV ──────────────────────────────────────────────────────────────
const CSV_PATH = path.resolve(process.cwd(), '../../uploads/Inventario_de_Equipos_de_Computo.csv');

// ── Mapeo de ubicaciones ────────────────────────────────────────────────────
const LOCATION_MAP: Record<string, string> = {
  'leon (valle del moral)': 'León',
  'león (valle del moral)': 'León',
  'leon (level)': 'León',
  'león (level)': 'León',
  'cdmx': 'Ciudad de México',
  'colombia': 'Medellín',
  'estados unidos': 'Charlotte',
  'guadalajara': 'Guadalajara',
};

function mapLocation(raw: string): string {
  return LOCATION_MAP[raw.toLowerCase().trim()] ?? raw.trim();
}

// ── Parser CSV simple (maneja comillas y comas dentro de campos) ─────────────
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ── Parsear valor monetario "$1,234.56" → número ───────────────────────────
function parseMoney(raw: string): number {
  const clean = raw.replace(/[$,\s]/g, '').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

// ── Parsear fecha ISO a YYYY-MM-DD ──────────────────────────────────────────
function parseDate(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0]!;
  } catch {
    return null;
  }
}

// ── Parsear boolean (True/False/Verdadero/Falso) ────────────────────────────
function parseBool(raw: string): boolean {
  return /^(true|verdadero|si|yes|1)$/i.test(raw.trim());
}

// ── Generar display_id ──────────────────────────────────────────────────────
function makeDisplayId(year: number, seq: number): string {
  return `TEC-${year}-${String(seq).padStart(3, '0')}`;
}

async function main() {
  await AppDataSource.initialize();
  const equipmentRepo = AppDataSource.getRepository(Equipment);
  const employeesRepo = AppDataSource.getRepository(EmployeeRecord);

  // Leer CSV — primera línea es schema SharePoint, segunda son headers
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const allLines = raw.split(/\r?\n/).filter((l) => l.trim());

  // allLines[0] = schema, allLines[1] = headers, allLines[2+] = data
  const headerLine = allLines[1];
  if (!headerLine) throw new Error('CSV inválido: no se encontraron headers en la línea 2');

  const headers = parseCsvLine(headerLine);
  const dataLines = allLines.slice(2);

  console.log(`CSV leído: ${dataLines.length} filas de datos`);

  // Cargar todos los empleados por email para lookup rápido
  const allEmployees = await employeesRepo.find({ select: ['id', 'corporateEmail', 'fullName', 'area', 'location'] });
  const employeeByEmail = new Map<string, EmployeeRecord>();
  for (const emp of allEmployees) {
    if (emp.corporateEmail) employeeByEmail.set(emp.corporateEmail.toLowerCase(), emp);
  }
  console.log(`Empleados cargados: ${employeeByEmail.size}`);

  // Cargar IDs legados ya existentes para idempotencia
  const existing = await equipmentRepo.find({ select: ['legacyId'] });
  const existingLegacyIds = new Set(existing.map((e) => e.legacyId).filter(Boolean));
  console.log(`Equipos ya existentes en BD: ${existingLegacyIds.size}`);

  // Contadores de display_id por año
  const yearCounters: Record<number, number> = {};
  // Pre-cargar contadores desde los existentes
  const existingDisplayIds = await equipmentRepo.find({ select: ['displayId'] });
  for (const e of existingDisplayIds) {
    if (e.displayId && e.displayId.startsWith('TEC-')) {
      const parts = e.displayId.split('-');
      const y = parseInt(parts[1] ?? '0', 10);
      const n = parseInt(parts[2] ?? '0', 10);
      if (!isNaN(y) && !isNaN(n)) {
        yearCounters[y] = Math.max(yearCounters[y] ?? 0, n);
      }
    }
  }

  let inserted = 0;
  let skipped = 0;
  let emailNotFound = 0;

  for (const line of dataLines) {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });

    const legacyId = row['ID LIEVANT']?.trim() || null;
    if (!legacyId) { skipped++; continue; }
    if (existingLegacyIds.has(legacyId)) { skipped++; continue; }

    const purchaseDateStr = parseDate(row['FECHA DE COMPRA'] ?? '');
    const purchaseYear = purchaseDateStr ? new Date(purchaseDateStr).getFullYear() : 2025;

    yearCounters[purchaseYear] = (yearCounters[purchaseYear] ?? 0) + 1;
    const displayId = makeDisplayId(purchaseYear, yearCounters[purchaseYear]!);

    const emailRaw = (row['ASIGNADO A'] ?? '').trim().toLowerCase();
    let assignedToEmployeeId: string | null = null;
    let employeeArea: string | null = null;
    let employeeLocation: string | null = null;
    let extraNote = '';

    if (emailRaw) {
      const emp = employeeByEmail.get(emailRaw);
      if (emp) {
        assignedToEmployeeId = emp.id;
        employeeArea = emp.area ?? null;
        employeeLocation = emp.location ?? null;
      } else {
        emailNotFound++;
        extraNote = `Asignado a (email no encontrado): ${emailRaw}`;
      }
    }

    const rawLocation = row['UBICACION'] ?? '';
    const location = rawLocation ? mapLocation(rawLocation) : (employeeLocation ?? null);
    const area = row['AREA']?.trim() || employeeArea || null;

    const notesRaw = (row['NOTAS TI'] ?? '').trim();
    const notes = [notesRaw, extraNote].filter(Boolean).join(' | ') || null;

    const equipment = equipmentRepo.create({
      displayId,
      legacyId,
      equipmentType: row['TIPO EQUIPO']?.trim() || 'Desconocido',
      brand: row['MARCA']?.trim() || null,
      model: row['MODELO']?.trim() || null,
      serialNumber: row['No DE SERIE']?.trim() || null,
      operatingSystem: row['SISTEMA OPERATIVO']?.trim() || null,
      adName: row['Nombre Active Directory']?.trim() || null,
      specifications: row['ESPECIFICACIONES']?.trim() || null,
      assignedToEmployeeId,
      assignmentDate: parseDate(row['FECHA ASIGNACION'] ?? ''),
      responsiva: row['RESPONSIVA']?.trim() || null,
      chargerIncluded: parseBool(row['CARGADOR INCLUIDO'] ?? ''),
      status: row['ESTATUS']?.trim() || 'Disponible',
      location,
      area,
      purchaseDate: purchaseDateStr,
      purchaseValue: parseMoney(row['VALOR EQUIPO'] ?? ''),
      notes,
    });

    await equipmentRepo.save(equipment);
    existingLegacyIds.add(legacyId);
    inserted++;

    if (inserted % 50 === 0) console.log(`  Insertados: ${inserted}...`);
  }

  console.log('\n── Resultado ──────────────────────────────────────');
  console.log(`✅ Insertados:          ${inserted}`);
  console.log(`⏭  Omitidos (ya existen o vacíos): ${skipped}`);
  console.log(`⚠  Email no encontrado: ${emailNotFound}`);

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
