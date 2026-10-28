import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RRHH 2.0 · M6-B — Matriz de Puestos con el Excel de la división (importación y campos nuevos).
 *
 * Todo es aditivo e idempotente:
 *  - `hr.job_positions`: división, jerarquía MEOT, reporta a / supervisa a (texto), plazas, rol,
 *    objetivo del puesto, puntos a validar, estado de validación (+ quién y cuándo) y comentarios del Head.
 *  - `hr.job_position_activities`: actividades por grupo con frecuencia y nota.
 *  - `hr.job_position_okrs`: `period` admite NULL (plantilla base) y se agregan `objective_code` y `kr_code`.
 *  - Frecuencias de KPI ampliadas (diario, semanal, quincenal) en `hr.job_position_kpis` y `hr.employee_kpis`.
 *  - `hr.employee_okrs`: códigos de objetivo/KR y el índice único por origen incluye el periodo
 *    (una plantilla sin periodo puede asignarse en S1 y luego en S2).
 *  - Permiso `rrhh.matriz-puestos.import` (solo SUPER_ADMIN por rol).
 *
 * `down()` revierte lo que añade. Antes de restaurar las restricciones de frecuencia originales pone
 * en NULL las frecuencias nuevas (diario, semanal, quincenal) de ambos KPIs; antes de volver a exigir
 * `period` da de baja lógica las filas de plantilla sin periodo (no caben en el esquema anterior) y les pone un periodo
 * marcador '1970-S1'; con eso los OKRs con periodo se conservan intactos.
 */
export class MatrizPuestosExcel1751000000041 implements MigrationInterface {
  name = 'MatrizPuestosExcel1751000000041';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE hr.job_positions
        ADD COLUMN IF NOT EXISTS division VARCHAR(100),
        ADD COLUMN IF NOT EXISTS meot_hierarchy VARCHAR(100),
        ADD COLUMN IF NOT EXISTS reports_to_text VARCHAR(500),
        ADD COLUMN IF NOT EXISTS supervises_text VARCHAR(500),
        ADD COLUMN IF NOT EXISTS plazas INTEGER,
        ADD COLUMN IF NOT EXISTS role_summary TEXT,
        ADD COLUMN IF NOT EXISTS position_objective TEXT,
        ADD COLUMN IF NOT EXISTS validation_points TEXT,
        ADD COLUMN IF NOT EXISTS head_comments TEXT,
        ADD COLUMN IF NOT EXISTS validation_status VARCHAR(30) NOT NULL DEFAULT 'pendiente',
        ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES auth.users(id),
        ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_positions_plazas_check') THEN
          ALTER TABLE hr.job_positions ADD CONSTRAINT job_positions_plazas_check CHECK (plazas IS NULL OR plazas >= 0);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_positions_validation_status_check') THEN
          ALTER TABLE hr.job_positions ADD CONSTRAINT job_positions_validation_status_check
            CHECK (validation_status IN ('pendiente','validado','validado_con_ajustes','rechazado'));
        END IF;
      END $$
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_job_positions_division ON hr.job_positions (division) WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hr.job_position_activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_position_id UUID NOT NULL REFERENCES hr.job_positions(id),
        group_order INTEGER NOT NULL,
        group_title VARCHAR(300) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        description TEXT NOT NULL,
        frequency VARCHAR(20) CHECK (frequency IS NULL OR frequency IN
          ('diario','semanal','quincenal','mensual','trimestral','semestral','anual','eventual')),
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_job_position_activities_position
      ON hr.job_position_activities (job_position_id) WHERE deleted_at IS NULL
    `);

    // OKRs de la Matriz: periodo opcional (NULL = plantilla) y códigos O1 / KR1.
    await queryRunner.query(`ALTER TABLE hr.job_position_okrs ALTER COLUMN period DROP NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE hr.job_position_okrs
        ADD COLUMN IF NOT EXISTS objective_code VARCHAR(10),
        ADD COLUMN IF NOT EXISTS kr_code VARCHAR(10)
    `);

    // Frecuencias de KPI ampliadas; los nombres reales se buscan en pg_constraint.
    await this.replaceFrequencyCheck(
      queryRunner,
      'hr.job_position_kpis',
      'job_position_kpis_measurement_frequency_check',
      ['diario', 'semanal', 'quincenal', 'mensual', 'trimestral', 'semestral', 'anual'],
    );
    await this.replaceFrequencyCheck(
      queryRunner,
      'hr.employee_kpis',
      'employee_kpis_measurement_frequency_check',
      ['diario', 'semanal', 'quincenal', 'mensual', 'trimestral', 'semestral', 'anual'],
    );

    // Copias de OKRs en M5: códigos y unicidad por (colaborador, OKR de origen, periodo).
    await queryRunner.query(`
      ALTER TABLE hr.employee_okrs
        ADD COLUMN IF NOT EXISTS objective_code VARCHAR(10),
        ADD COLUMN IF NOT EXISTS kr_code VARCHAR(10)
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS hr.uq_employee_okrs_source`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_okrs_source
      ON hr.employee_okrs (employee_id, job_position_okr_id, period)
      WHERE deleted_at IS NULL AND job_position_okr_id IS NOT NULL
    `);

    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES ('rrhh', 'matriz-puestos', 'import', 'Importar la Matriz de Puestos desde Excel')
      ON CONFLICT (section, module, action) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE p.section = 'rrhh' AND p.module = 'matriz-puestos' AND p.action = 'import' AND r.name = 'SUPER_ADMIN'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.user_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'rrhh' AND module = 'matriz-puestos' AND action = 'import')
    `);
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'rrhh' AND module = 'matriz-puestos' AND action = 'import')
    `);
    await queryRunner.query(`DELETE FROM auth.permissions WHERE section = 'rrhh' AND module = 'matriz-puestos' AND action = 'import'`);

    // Las copias de plantilla (mismo origen en dos periodos) no caben en el índice anterior: se conserva la más reciente.
    await queryRunner.query(`
      UPDATE hr.employee_okrs e SET deleted_at = NOW()
      WHERE e.deleted_at IS NULL AND e.job_position_okr_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM hr.employee_okrs o
        WHERE o.employee_id = e.employee_id AND o.job_position_okr_id = e.job_position_okr_id
          AND o.deleted_at IS NULL AND o.id <> e.id AND (o.period, o.id) > (e.period, e.id)
      )
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS hr.uq_employee_okrs_source`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_okrs_source
      ON hr.employee_okrs (employee_id, job_position_okr_id)
      WHERE deleted_at IS NULL AND job_position_okr_id IS NOT NULL
    `);
    await queryRunner.query(`ALTER TABLE hr.employee_okrs DROP COLUMN IF EXISTS kr_code, DROP COLUMN IF EXISTS objective_code`);

    await this.restoreFrequencyCheck(queryRunner, 'hr.employee_kpis', 'employee_kpis_measurement_frequency_check');
    await this.restoreFrequencyCheck(queryRunner, 'hr.job_position_kpis', 'job_position_kpis_measurement_frequency_check');

    await queryRunner.query(`UPDATE hr.job_position_okrs SET deleted_at = COALESCE(deleted_at, NOW()) WHERE period IS NULL`);
    await queryRunner.query(`UPDATE hr.job_position_okrs SET period = '1970-S1' WHERE period IS NULL`);
    await queryRunner.query(`ALTER TABLE hr.job_position_okrs ALTER COLUMN period SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE hr.job_position_okrs DROP COLUMN IF EXISTS kr_code, DROP COLUMN IF EXISTS objective_code`);

    await queryRunner.query(`DROP TABLE IF EXISTS hr.job_position_activities`);
    await queryRunner.query(`DROP INDEX IF EXISTS hr.idx_job_positions_division`);
    await queryRunner.query(`ALTER TABLE hr.job_positions DROP CONSTRAINT IF EXISTS job_positions_validation_status_check`);
    await queryRunner.query(`ALTER TABLE hr.job_positions DROP CONSTRAINT IF EXISTS job_positions_plazas_check`);
    await queryRunner.query(`
      ALTER TABLE hr.job_positions
        DROP COLUMN IF EXISTS validated_at, DROP COLUMN IF EXISTS validated_by, DROP COLUMN IF EXISTS validation_status,
        DROP COLUMN IF EXISTS head_comments, DROP COLUMN IF EXISTS validation_points, DROP COLUMN IF EXISTS position_objective,
        DROP COLUMN IF EXISTS role_summary, DROP COLUMN IF EXISTS plazas, DROP COLUMN IF EXISTS supervises_text,
        DROP COLUMN IF EXISTS reports_to_text, DROP COLUMN IF EXISTS meot_hierarchy, DROP COLUMN IF EXISTS division
    `);
  }

  /** Quita cualquier CHECK de `measurement_frequency` (el nombre real se lee de pg_constraint) y pone el nuevo. */
  private async replaceFrequencyCheck(queryRunner: QueryRunner, table: string, name: string, values: string[]): Promise<void> {
    const list = values.map((v) => `'${v}'`).join(',');
    await queryRunner.query(`
      DO $$ DECLARE c RECORD; BEGIN
        FOR c IN SELECT conname FROM pg_constraint
                 WHERE conrelid = '${table}'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%measurement_frequency%'
        LOOP
          EXECUTE format('ALTER TABLE ${table} DROP CONSTRAINT %I', c.conname);
        END LOOP;
        ALTER TABLE ${table} ADD CONSTRAINT ${name}
          CHECK (measurement_frequency IS NULL OR measurement_frequency IN (${list}));
      END $$
    `);
  }

  private async restoreFrequencyCheck(queryRunner: QueryRunner, table: string, name: string): Promise<void> {
    await queryRunner.query(
      `UPDATE ${table} SET measurement_frequency = NULL WHERE measurement_frequency IN ('diario','semanal','quincenal')`,
    );
    await this.replaceFrequencyCheck(queryRunner, table, name, ['mensual', 'trimestral', 'semestral', 'anual']);
  }
}
