import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RRHH 2.0 · Módulo 7: evaluación semestral de los OKRs por el líder directo.
 *
 * Aditiva e idempotente. Se evalúa el OKR ASIGNADO al colaborador (la copia del M5,
 * `hr.employee_okrs`), no el de la Matriz.
 *
 * - `score` es DECIMAL(5,2) (el RFP decía (4,2), que no cabe el 100) con rango 0–100.
 * - `status`: `completada` si y solo si hay `score`; `pendiente` si solo hay comentarios.
 * - Las evaluaciones se crean al guardar (upsert por OKR asignado); los OKRs sin
 *   evaluación son "Pendiente" en pantallas y reporte, sin filas vacías precreadas.
 * - `objective`, `key_result` y `weight` son snapshots del primer guardado.
 * - Una evaluación por OKR asignado (índice único parcial); soft delete.
 *
 * Permisos: `rrhh.okrs.read` (ver el reporte y exportarlo) para SUPER_ADMIN y
 * DIRECTOR. Calificar NO es un permiso: lo hace solo el líder directo.
 */
export class CreateOkrEvaluations1751000000040 implements MigrationInterface {
  name = 'CreateOkrEvaluations1751000000040';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hr.okr_evaluations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_okr_id UUID NOT NULL REFERENCES hr.employee_okrs(id),
        employee_id UUID NOT NULL REFERENCES employees.employee_records(id),
        evaluator_employee_id UUID NOT NULL REFERENCES employees.employee_records(id),
        evaluator_user_id UUID REFERENCES auth.users(id),
        period VARCHAR(20) NOT NULL CHECK (period ~ '^[0-9]{4}-S[12]$'),
        objective TEXT NOT NULL,
        key_result TEXT NOT NULL,
        weight DECIMAL(5,2),
        score DECIMAL(5,2) CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
        comments TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','completada')),
        evaluated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_okr_evaluations_okr
      ON hr.okr_evaluations (employee_okr_id) WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_okr_evaluations_employee_period
      ON hr.okr_evaluations (employee_id, period) WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_okr_evaluations_period_status
      ON hr.okr_evaluations (period, status) WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES ('rrhh', 'okrs', 'read', 'Ver el reporte de evaluación de OKRs y exportarlo')
      ON CONFLICT (section, module, action) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'DIRECTOR')
        AND p.section = 'rrhh' AND p.module = 'okrs'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.user_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'rrhh' AND module = 'okrs')
    `);
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'rrhh' AND module = 'okrs')
    `);
    await queryRunner.query(`DELETE FROM auth.permissions WHERE section = 'rrhh' AND module = 'okrs'`);

    await queryRunner.query(`DROP INDEX IF EXISTS hr.idx_okr_evaluations_period_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS hr.idx_okr_evaluations_employee_period`);
    await queryRunner.query(`DROP INDEX IF EXISTS hr.uq_okr_evaluations_okr`);
    await queryRunner.query(`DROP TABLE IF EXISTS hr.okr_evaluations`);
  }
}
