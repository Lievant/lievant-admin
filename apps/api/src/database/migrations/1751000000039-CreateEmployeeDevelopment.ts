import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RRHH 2.0 · Módulo 5: Desarrollo Organizacional del colaborador.
 *
 * Aditiva e idempotente. DECISIONES PROVISIONALES (Paulo las confirmará):
 * - El vínculo colaborador ↔ puesto es una columna nueva y manual
 *   (`employee_records.job_position_id`, nulable, sin valor por defecto: no cambia
 *   ningún dato existente).
 * - Los OKRs y KPIs del colaborador viven en tablas propias como COPIA (snapshot)
 *   del puesto: texto y peso se copian y no se actualizan solos.
 *
 * - `employee_okrs` / `employee_kpis` guardan el puesto y el OKR/KPI de origen;
 *   un índice único parcial evita copiar dos veces lo mismo.
 * - Soft delete (`deleted_at`) en todo.
 *
 * Permisos: `rrhh.desarrollo-organizacional.read|write` para SUPER_ADMIN y DIRECTOR
 * (mismo patrón que la Matriz de Puestos).
 */
export class CreateEmployeeDevelopment1751000000039 implements MigrationInterface {
  name = 'CreateEmployeeDevelopment1751000000039';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE employees.employee_records
      ADD COLUMN IF NOT EXISTS job_position_id UUID REFERENCES hr.job_positions(id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_records_job_position
      ON employees.employee_records (job_position_id) WHERE job_position_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hr.employee_okrs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES employees.employee_records(id),
        job_position_id UUID NOT NULL REFERENCES hr.job_positions(id),
        job_position_okr_id UUID REFERENCES hr.job_position_okrs(id),
        period VARCHAR(20) NOT NULL CHECK (period ~ '^[0-9]{4}-S[12]$'),
        objective TEXT NOT NULL,
        key_result TEXT NOT NULL,
        weight DECIMAL(5,2) CHECK (weight IS NULL OR (weight >= 0 AND weight <= 100)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_okrs_source
      ON hr.employee_okrs (employee_id, job_position_okr_id)
      WHERE deleted_at IS NULL AND job_position_okr_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_okrs_employee_period
      ON hr.employee_okrs (employee_id, period) WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hr.employee_kpis (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES employees.employee_records(id),
        job_position_id UUID NOT NULL REFERENCES hr.job_positions(id),
        job_position_kpi_id UUID REFERENCES hr.job_position_kpis(id),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        target_value VARCHAR(100),
        measurement_frequency VARCHAR(30)
          CHECK (measurement_frequency IS NULL OR measurement_frequency IN ('mensual','trimestral','semestral','anual')),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_kpis_source
      ON hr.employee_kpis (employee_id, job_position_kpi_id)
      WHERE deleted_at IS NULL AND job_position_kpi_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_kpis_employee
      ON hr.employee_kpis (employee_id) WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('rrhh', 'desarrollo-organizacional', 'read', 'Ver el desarrollo organizacional de los colaboradores (puesto, OKRs y KPIs)'),
        ('rrhh', 'desarrollo-organizacional', 'write', 'Vincular puesto y asignar o quitar OKRs y KPIs de un colaborador')
      ON CONFLICT (section, module, action) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'DIRECTOR')
        AND p.section = 'rrhh' AND p.module = 'desarrollo-organizacional'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.user_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'rrhh' AND module = 'desarrollo-organizacional')
    `);
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'rrhh' AND module = 'desarrollo-organizacional')
    `);
    await queryRunner.query(`DELETE FROM auth.permissions WHERE section = 'rrhh' AND module = 'desarrollo-organizacional'`);

    await queryRunner.query(`DROP INDEX IF EXISTS hr.idx_employee_kpis_employee`);
    await queryRunner.query(`DROP INDEX IF EXISTS hr.uq_employee_kpis_source`);
    await queryRunner.query(`DROP TABLE IF EXISTS hr.employee_kpis`);
    await queryRunner.query(`DROP INDEX IF EXISTS hr.idx_employee_okrs_employee_period`);
    await queryRunner.query(`DROP INDEX IF EXISTS hr.uq_employee_okrs_source`);
    await queryRunner.query(`DROP TABLE IF EXISTS hr.employee_okrs`);

    await queryRunner.query(`DROP INDEX IF EXISTS employees.idx_employee_records_job_position`);
    await queryRunner.query(`ALTER TABLE employees.employee_records DROP COLUMN IF EXISTS job_position_id`);
  }
}
