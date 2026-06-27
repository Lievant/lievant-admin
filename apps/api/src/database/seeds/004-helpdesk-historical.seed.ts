import * as fs from 'fs';
import * as path from 'path';
import AppDataSource from '../data-source';

// ---------------------------------------------------------------------------
// CSV parser (handles quoted fields)
// ---------------------------------------------------------------------------
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (ch === '"') {
      if (inQuotes && line.charAt(i + 1) === '"') { current += '"'; i++; }
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

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  const headers = parseCsvLine(lines[0] ?? '');
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''] as [string, string]));
  });
}

// ---------------------------------------------------------------------------
// Category inference
// ---------------------------------------------------------------------------
function inferCategory(description: string): string {
  const d = description.toLowerCase();
  if (/internet|wifi|wi-fi|ethernet|vpn|red |caída isp|conectividad/.test(d)) return 'conectividad';
  if (/servidor|dns|firewall|dominio|infraestructura|almacenamiento|active directory/.test(d)) return 'infraestructura';
  if (/phishing|hackeo|hack|seguridad|malware|acceso no autorizado|pérdida.*dispositivo/.test(d)) return 'seguridad';
  if (/bitlocker|equipo|laptop|pc |computadora|teclado|mouse|pantalla|monitor|batería|webcam|periférico|audífonos|bluetooth/.test(d)) return 'equipos';
  if (/correo|email|alias|firma.*electrónica|buzón|buzon|outlook|exchange/.test(d)) return 'correo';
  if (/contraseña|password|acceso|active directory|mfa|cuenta|desbloqueo|permiso/.test(d)) return 'accesos';
  if (/office|365|adobe|software|windows|impresora|antivirus|aplicaci|onedrive|sharepoint|teams|zoom|instalaci/.test(d)) return 'software';
  return 'software';
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------
function mapStatus(raw: string): string {
  const s = (raw ?? '').trim().toLowerCase();
  if (s === 'cerrado') return 'cerrado';
  if (s === 'en revisión' || s === 'en revision') return 'en_revision';
  if (s === 'abierto') return 'abierto';
  return 'cerrado';
}

function mapProblemStatus(raw: string): string | null {
  const s = (raw ?? '').trim().toLowerCase();
  if (s === 'resuelto') return 'resuelto';
  if (s.includes('no se puede')) return 'no_se_puede';
  if (s === 'cancelado') return 'cancelado';
  return null;
}

// ---------------------------------------------------------------------------
// Parse date (M/D/YYYY H:MM AM/PM)
// ---------------------------------------------------------------------------
function parseDate(raw: string): Date | null {
  if (!raw || !raw.trim()) return null;
  const d = new Date(raw.trim());
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Priority from category
// ---------------------------------------------------------------------------
const CAT_PRIORITY: Record<string, string> = {
  conectividad: 'P1', infraestructura: 'P1', seguridad: 'P1',
  equipos: 'P2', accesos: 'P3', software: 'P3', correo: 'P3', mejora: 'P4',
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const csvPath = path.resolve(__dirname, '../../../../../..', 'Users/paob2/Downloads/Atención Soporte TD.csv');
  // Try absolute Windows path as fallback
  const absolutePath = 'C:\\Users\\paob2\\Downloads\\Atención Soporte TD.csv';
  const filePath = fs.existsSync(csvPath) ? csvPath : absolutePath;

  if (!fs.existsSync(filePath)) {
    console.error('CSV not found at:', filePath);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCsv(content);
  console.log(`Parsed ${rows.length} rows from CSV`);

  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();
  await qr.connect();

  // Look up assigned_to user IDs by name
  const users: Array<{ id: string; name: string }> = await qr.query(
    `SELECT id, name FROM auth.users WHERE is_active = true`,
  );

  function findUserId(name: string): string | null {
    if (!name || !name.trim()) return null;
    const norm = name.trim().toLowerCase().replace(/\s+/g, ' ');
    const match = users.find((u) => {
      const un = u.name.toLowerCase().replace(/\s+/g, ' ');
      const normFirst = norm.split(' ')[0] ?? '';
      const unFirst = un.split(' ')[0] ?? '';
      return un === norm || un.includes(normFirst) || norm.includes(unFirst);
    });
    return match?.id ?? null;
  }

  // Track display_id counters per year
  const yearCounters: Record<number, number> = {};

  function nextDisplayId(date: Date): string {
    const year = date.getFullYear();
    yearCounters[year] = (yearCounters[year] ?? 0) + 1;
    return `TIC-${year}-${String(yearCounters[year]).padStart(3, '0')}`;
  }

  // Check for existing historical tickets to avoid duplication
  const existingCount: Array<{ count: string }> = await qr.query(
    `SELECT COUNT(*) AS count FROM helpdesk.tickets WHERE is_historical = true`,
  );
  const existingEntry = existingCount[0] ?? { count: '0' };
  if (Number(existingEntry.count) > 0) {
    console.log(`Found ${existingEntry.count} existing historical tickets — skipping seed.`);
    await qr.release();
    await AppDataSource.destroy();
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const description = (row['DESCRIPCION SOLICITUD'] ?? '').trim() || 'Ticket histórico importado';
    const requestedAt = parseDate(row['FECHA SOLICITUD'] ?? '') ?? new Date();
    const closedAt = parseDate(row['FECHA DE ENTREGA'] ?? '');
    const status = mapStatus(row['Estado del ticket'] ?? '');
    const problemStatus = mapProblemStatus(row['Estado del problema'] ?? '');
    const category = inferCategory(description + ' ' + (row['DIAGNOSTICO TI'] ?? ''));
    const priority = CAT_PRIORITY[category] ?? 'P3';
    const assignedUserId = findUserId(row['Atendido por'] ?? '');
    const displayId = nextDisplayId(requestedAt);

    const resolutionHours =
      closedAt && status === 'cerrado'
        ? ((closedAt.getTime() - requestedAt.getTime()) / 3_600_000).toFixed(2)
        : null;

    try {
      await qr.query(
        `INSERT INTO helpdesk.tickets (
          display_id, requester_name, category, description, impact, priority,
          assigned_to, diagnosis, problem_status, status,
          equipment_id, requested_at, closed_at, resolved_at, resolution_hours,
          origin, is_historical
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
        )`,
        [
          displayId,
          (row['SOLICITA'] ?? '').trim() || 'Desconocido',
          category,
          description,
          'medio',
          priority,
          assignedUserId ?? null,
          (row['DIAGNOSTICO TI'] ?? '').trim() || null,
          problemStatus ?? null,
          status,
          ((row['ID EQUIPO'] ?? '').trim() || '').substring(0, 50) || null,
          requestedAt.toISOString(),
          closedAt ? closedAt.toISOString() : null,
          status === 'cerrado' && closedAt ? closedAt.toISOString() : null,
          resolutionHours ?? null,
          'IMPORTADO',
          true,
        ],
      );
      inserted++;
    } catch (err) {
      console.warn(`  ⚠ Fila ${displayId} omitida:`, err instanceof Error ? err.message : String(err));
      skipped++;
    }
  }

  console.log(`✅ Seed completado: ${inserted} tickets insertados, ${skipped} omitidos.`);
  await qr.release();
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
