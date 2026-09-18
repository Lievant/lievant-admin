import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Licencias individuales: un registro por licencia asignada, no un contador.
 *
 * `tools.tool_assignments` (migración 20) modela el vínculo herramienta ↔
 * colaborador; esta tabla modela la licencia misma —su folio LIC-###, su tipo
 * dentro del producto ('Business', 'Enterprise'), su costo real y su
 * vencimiento— que es lo que aparece en una factura y lo que se audita. Un
 * colaborador puede tener dos licencias distintas de la misma herramienta
 * (personal y compartida), cosa que el índice único de las asignaciones impide
 * a propósito.
 *
 * `business_unit` se copia del área del colaborador al asignar en vez de
 * leerse por JOIN: el costo tiene que quedar imputado al área que lo autorizó
 * aunque después la persona cambie de área.
 *
 * `employee_id` y `employee_user_id` conviven porque no toda licencia va a un
 * colaborador del padrón de RRHH: las de servicio (cuentas de sistema, buzones
 * compartidos) solo tienen usuario de la plataforma.
 */
export class CreateLicensesModule1751000000021 implements MigrationInterface {
  name = 'CreateLicensesModule1751000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS tools.license_number_seq
        START 1 INCREMENT 1
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tools.licenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Código correlativo: LIC-001
        license_code VARCHAR(15) UNIQUE NOT NULL,

        -- Herramienta a la que pertenece esta licencia
        tool_id UUID NOT NULL REFERENCES tools.tools(id),

        -- Colaborador asignado
        employee_id UUID REFERENCES employees.employee_records(id),
        employee_user_id UUID REFERENCES auth.users(id),

        -- Tipo dentro de la misma herramienta: 'Business', 'Enterprise'…
        license_type VARCHAR(100),

        -- Unidad de negocio (se toma del área del colaborador al asignar)
        business_unit VARCHAR(100),

        -- Costo real de esta licencia (puede diferir del unitario por descuentos)
        unit_cost DECIMAL(14,2),
        currency VARCHAR(3),

        -- 'activa' | 'pendiente_aprobacion' | 'suspendida' | 'cancelada'
        status VARCHAR(30) NOT NULL DEFAULT 'activa',

        assigned_at DATE NOT NULL DEFAULT CURRENT_DATE,
        expires_at DATE,

        notes TEXT,

        assigned_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_licenses_tool ON tools.licenses(tool_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_licenses_employee ON tools.licenses(employee_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_licenses_status ON tools.licenses(status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_licenses_business_unit ON tools.licenses(business_unit)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_licenses_expires_at ON tools.licenses(expires_at)`,
    );

    // ── Permisos ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('transformacion', 'licencias', 'read', 'Ver licencias asignadas'),
        ('transformacion', 'licencias', 'write', 'Gestionar asignación de licencias')
      ON CONFLICT (section, module, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'DIRECTOR')
        AND p.section = 'transformacion' AND p.module = 'licencias'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions
        WHERE section = 'transformacion' AND module = 'licencias'
      )
    `);

    await queryRunner.query(`
      DELETE FROM auth.permissions
      WHERE section = 'transformacion' AND module = 'licencias'
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS tools.licenses`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS tools.license_number_seq`);
  }
}
