/**
 * Seed: 4 proyectos activos de Cor (skip los 2 internos de Lievant).
 * Idempotente por cor_project_id.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

for (const f of ['.env.local', '.env', '../../.env.local', '../../.env']) {
  dotenv.config({ path: path.resolve(process.cwd(), f) });
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no definido');

const ds = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: process.env.DATABASE_SCHEMA ?? 'auth',
  synchronize: false,
  logging: false,
});

interface ProjectSeedRow {
  cor_project_id: string;
  pm_code: string;
  name: string;
  project_type: 'one_time' | 'recurring';
  client_display_id: string | null;
}

const PROJECTS: ProjectSeedRow[] = [
  {
    cor_project_id: 'OMN-SOPORTE-INTEPIEL-002',
    pm_code: 'OMN-SOPORTE-INTEPIEL-002',
    name: 'Soporte Intepiel',
    project_type: 'one_time',
    client_display_id: 'CLI-0063',
  },
  {
    cor_project_id: 'OMN-SIOcore-DISLICORES-003',
    pm_code: 'OMN-SIOcore-DISLICORES-003',
    name: 'SIOcore Dislicores',
    project_type: 'one_time',
    client_display_id: 'CLI-0102',
  },
  {
    cor_project_id: 'OMN-SIOcore-CUADRA-Parcializados-4',
    pm_code: 'OMN-SIOcore-CUADRA-Parcializados-4',
    name: 'SIOcore Cuadra — Parcializados',
    project_type: 'one_time',
    client_display_id: 'CLI-0010',
  },
  {
    cor_project_id: 'OMN-SIOcore-CUADRA-Soporte-5',
    pm_code: 'OMN-SIOcore-CUADRA-Soporte-5',
    name: 'SIOcore Cuadra — Soporte',
    project_type: 'recurring',
    client_display_id: 'CLI-0010',
  },
];

async function main() {
  await ds.initialize();
  console.log('✓ Conectado a PostgreSQL');

  // Buscar PM por email
  const pmRow = await ds.query(
    `SELECT id FROM employees.employee_records WHERE corporate_email = $1 AND deleted_at IS NULL LIMIT 1`,
    ['paulo@lievant.com'],
  ) as { id: string }[];
  const pmId: string | null = pmRow[0]?.id ?? null;
  console.log(`PM (paulo@lievant.com): ${pmId ?? 'NO ENCONTRADO'}`);

  let created = 0;
  let skipped = 0;

  for (const row of PROJECTS) {
    // Verificar si ya existe
    const existing = await ds.query(
      `SELECT id FROM projects.project_records WHERE cor_project_id = $1`,
      [row.cor_project_id],
    ) as { id: string }[];

    if (existing.length > 0) {
      console.log(`  SKIP  ${row.cor_project_id} (ya existe: ${existing[0]!.id})`);
      skipped++;
      continue;
    }

    // Buscar cliente por display_id
    let clientId: string | null = null;
    if (row.client_display_id) {
      const clientRow = await ds.query(
        `SELECT id FROM clients.client_records WHERE display_id = $1 LIMIT 1`,
        [row.client_display_id],
      ) as { id: string }[];
      clientId = clientRow[0]?.id ?? null;
    }

    // Generar display_id
    const seqRow = await ds.query(`SELECT nextval('projects.project_display_id_seq') AS seq`) as { seq: string }[];
    const seq = parseInt(seqRow[0]?.seq ?? '1', 10);
    const displayId = `PRY-${String(seq).padStart(4, '0')}`;

    await ds.query(
      `INSERT INTO projects.project_records
        (display_id, cor_project_id, pm_code, name, project_type, status,
         client_record_id, project_manager_id, cor_sync_status, cor_synced_at)
       VALUES ($1,$2,$3,$4,$5,'active',$6,$7,'synced',NOW())`,
      [displayId, row.cor_project_id, row.pm_code, row.name, row.project_type, clientId, pmId],
    );

    console.log(`  CREATED ${displayId} — ${row.name} (cliente: ${row.client_display_id ?? 'ninguno'}, PM: ${pmId ? 'sí' : 'no'})`);
    created++;
  }

  console.log(`\nResumen: ${created} creados, ${skipped} ya existían`);
  await ds.destroy();
}

main().catch((err) => { console.error(err); process.exit(1); });
