import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RRHH 2.0 · Módulo 6-A: Matriz de Puestos (puestos, OKRs base y KPIs base).
 *
 * Aditiva e idempotente: crea tres tablas en el esquema `hr` (que ya existe por
 * Vacaciones) y las filas de permisos `rrhh.matriz-puestos.*`; no toca ninguna
 * tabla existente.
 *
 * - `job_positions.code` (JP-001…) es único solo entre no eliminados (índice
 *   parcial): con soft delete una columna UNIQUE rompería. El consecutivo lo
 *   genera el servidor y no reutiliza códigos de puestos eliminados.
 * - `level` no tiene CHECK a propósito: el Excel de Paulo puede traer otros valores.
 * - OKRs y KPIs con soft delete (`deleted_at`) y `updated_at`.
 *
 * Permisos: `read`, `create`, `update`, `delete` para SUPER_ADMIN y DIRECTOR
 * (mismo patrón que la 036); `approve` solo para SUPER_ADMIN. A quien deba aprobar
 * se le da por permiso de usuario desde la pantalla de permisos.
 */
export class CreateJobPositionsMatrix1751000000037 implements MigrationInterface {
  name = 'CreateJobPositionsMatrix1751000000037';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS hr`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hr.job_positions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(20) NOT NULL,
        title VARCHAR(200) NOT NULL,
        area VARCHAR(100) NOT NULL,
        business_unit VARCHAR(100),
        level VARCHAR(50),
        description TEXT,
        description_approved BOOLEAN NOT NULL DEFAULT false,
        description_approved_by UUID REFERENCES auth.users(id),
        description_approved_at TIMESTAMPTZ,
        status VARCHAR(20) NOT NULL DEFAULT 'activo'
          CHECK (status IN ('activo','inactivo','pendiente_aprobacion')),
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_job_positions_code ON hr.job_positions (code) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_job_positions_area ON hr.job_positions (area)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_job_positions_status ON hr.job_positions (status)`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_job_positions_title ON hr.job_positions (lower(title))`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hr.job_position_okrs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_position_id UUID NOT NULL REFERENCES hr.job_positions(id),
        period VARCHAR(20) NOT NULL CHECK (period ~ '^[0-9]{4}-S[12]$'),
        objective TEXT NOT NULL,
        key_result TEXT NOT NULL,
        weight DECIMAL(5,2) CHECK (weight IS NULL OR (weight >= 0 AND weight <= 100)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_job_position_okrs_position
      ON hr.job_position_okrs (job_position_id, period) WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hr.job_position_kpis (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_position_id UUID NOT NULL REFERENCES hr.job_positions(id),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        target_value VARCHAR(100),
        measurement_frequency VARCHAR(30)
          CHECK (measurement_frequency IS NULL OR measurement_frequency IN ('mensual','trimestral','semestral','anual')),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_job_position_kpis_position
      ON hr.job_position_kpis (job_position_id) WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('rrhh', 'matriz-puestos', 'read', 'Ver la Matriz de Puestos (puestos, OKRs y KPIs)'),
        ('rrhh', 'matriz-puestos', 'create', 'Crear puestos en la Matriz de Puestos'),
        ('rrhh', 'matriz-puestos', 'update', 'Editar puestos, OKRs y KPIs de la Matriz de Puestos'),
        ('rrhh', 'matriz-puestos', 'delete', 'Eliminar puestos, OKRs y KPIs de la Matriz de Puestos'),
        ('rrhh', 'matriz-puestos', 'approve', 'Aprobar la descripción de un puesto')
      ON CONFLICT (section, module, action) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE p.section = 'rrhh' AND p.module = 'matriz-puestos'
        AND (
          (r.name IN ('SUPER_ADMIN', 'DIRECTOR') AND p.action IN ('read', 'create', 'update', 'delete'))
          OR (r.name = 'SUPER_ADMIN' AND p.action = 'approve')
        )
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.user_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'rrhh' AND module = 'matriz-puestos')
    `);
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'rrhh' AND module = 'matriz-puestos')
    `);
    await queryRunner.query(`DELETE FROM auth.permissions WHERE section = 'rrhh' AND module = 'matriz-puestos'`);

    await queryRunner.query(`DROP INDEX IF EXISTS hr.idx_job_position_kpis_position`);
    await queryRunner.query(`DROP TABLE IF EXISTS hr.job_position_kpis`);
    await queryRunner.query(`DROP INDEX IF EXISTS hr.idx_job_position_okrs_position`);
    await queryRunner.query(`DROP TABLE IF EXISTS hr.job_position_okrs`);
    await queryRunner.query(`DROP INDEX IF EXISTS hr.idx_job_positions_title`);
    await queryRunner.query(`DROP INDEX IF EXISTS hr.idx_job_positions_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS hr.idx_job_positions_area`);
    await queryRunner.query(`DROP INDEX IF EXISTS hr.uq_job_positions_code`);
    await queryRunner.query(`DROP TABLE IF EXISTS hr.job_positions`);
  }
}
