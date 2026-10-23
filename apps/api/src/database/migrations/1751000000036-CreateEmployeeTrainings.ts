import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RRHH 2.0 · Módulo 3: repositorio de Capacitaciones del colaborador.
 *
 * Aditiva: crea `employees.employee_trainings` y las filas de permisos
 * `rrhh.capacitaciones.read|write`; no toca ninguna tabla existente.
 *
 * - `development_type` guarda valores técnicos sin acento (`tecnico`,
 *   `habilidades_blandas`, `academico`); la interfaz los muestra con etiqueta.
 * - Fechas coherentes (`end_date` no menor que `start_date`) y duración con su
 *   unidad: los dos o ninguno.
 * - El certificado es opcional y vive en S3 (`certificate_s3_key`).
 * - Soft delete con `deleted_at`.
 *
 * Permisos: `rrhh.capacitaciones.read|write` para SUPER_ADMIN y DIRECTOR (mismo
 * patrón que la migración 034). El colaborador ve las suyas por Mi Información,
 * sin permiso especial.
 */
export class CreateEmployeeTrainings1751000000036 implements MigrationInterface {
  name = 'CreateEmployeeTrainings1751000000036';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS employees.employee_trainings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES employees.employee_records(id),
        name VARCHAR(300) NOT NULL,
        institution VARCHAR(200) NOT NULL,
        development_type VARCHAR(30) NOT NULL
          CHECK (development_type IN ('tecnico','habilidades_blandas','academico')),
        level VARCHAR(30)
          CHECK (level IN ('basico','intermedio','avanzado','especializacion')),
        start_date DATE NOT NULL,
        end_date DATE,
        duration_value INTEGER CHECK (duration_value IS NULL OR duration_value > 0),
        duration_unit VARCHAR(10) CHECK (duration_unit IN ('horas','meses')),
        is_company_recognition BOOLEAN NOT NULL DEFAULT false,
        certificate_s3_key VARCHAR(500),
        certificate_original_name VARCHAR(255),
        notes TEXT,
        created_by UUID REFERENCES auth.users(id),
        updated_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        CONSTRAINT chk_training_dates CHECK (end_date IS NULL OR end_date >= start_date),
        CONSTRAINT chk_training_duration_pair CHECK ((duration_value IS NULL) = (duration_unit IS NULL))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_employee_trainings_employee ON employees.employee_trainings (employee_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_employee_trainings_type ON employees.employee_trainings (development_type)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_employee_trainings_start ON employees.employee_trainings (start_date)`,
    );

    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('rrhh', 'capacitaciones', 'read', 'Ver las capacitaciones de los colaboradores'),
        ('rrhh', 'capacitaciones', 'write', 'Registrar, editar y eliminar capacitaciones y sus certificados')
      ON CONFLICT (section, module, action) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'DIRECTOR')
        AND p.section = 'rrhh' AND p.module = 'capacitaciones'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.user_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'rrhh' AND module = 'capacitaciones')
    `);
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'rrhh' AND module = 'capacitaciones')
    `);
    await queryRunner.query(`DELETE FROM auth.permissions WHERE section = 'rrhh' AND module = 'capacitaciones'`);

    await queryRunner.query(`DROP INDEX IF EXISTS employees.idx_employee_trainings_start`);
    await queryRunner.query(`DROP INDEX IF EXISTS employees.idx_employee_trainings_type`);
    await queryRunner.query(`DROP INDEX IF EXISTS employees.idx_employee_trainings_employee`);
    await queryRunner.query(`DROP TABLE IF EXISTS employees.employee_trainings`);
  }
}
