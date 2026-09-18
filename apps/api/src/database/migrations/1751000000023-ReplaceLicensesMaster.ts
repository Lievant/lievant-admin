import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reestructuración: `tools.assignments` sustituye a las dos tablas que este
 * módulo traía para lo mismo.
 *
 * Qué se deprecia y qué NO:
 *
 * - `tools.licenses` (migración 21) y `tools.tool_assignments` (migración 20)
 *   se renombran con sufijo _deprecated_20260918. Las dos modelaban el vínculo
 *   herramienta ↔ colaborador con reglas distintas y competían entre sí; la
 *   nueva tabla las unifica. Se renombran en vez de borrarse porque la
 *   auditoría ISO 27001 pide poder reconstruir quién tuvo acceso a qué.
 *
 * - `licenses.employee_licenses`, `licenses.tool_assignments` y
 *   `licenses.tool_catalog` NO se tocan. Ese es el Maestro de Licenciamientos
 *   (/transformacion/licenciamientos), un módulo distinto que está vivo en
 *   producción y que nadie pidió retirar; se llama parecido pero modela otra
 *   cosa —la matriz de acceso sí/no por colaborador, con nombre de AD y
 *   responsiva— y renombrarlo dejaría esa pantalla en 500.
 *
 * La regla "una persona no puede tener la misma herramienta activa dos veces"
 * va como índice único parcial y no como UNIQUE NULLS NOT DISTINCT sobre
 * (tool_id, employee_id, revocation_date): esa variante exige PostgreSQL 15+ y,
 * además, bloquearía revocar dos veces la misma herramienta al mismo empleado
 * en la misma fecha —reasignar y revocar el mismo día es un caso normal—.
 * El índice parcial expresa exactamente la regla enunciada y corre en cualquier
 * versión.
 */
export class ReplaceLicensesMaster1751000000023 implements MigrationInterface {
  name = 'ReplaceLicensesMaster1751000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Baja de las tablas superadas ─────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE IF EXISTS tools.licenses
        RENAME TO licenses_deprecated_20260918
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS tools.tool_assignments
        RENAME TO tool_assignments_deprecated_20260918
    `);

    // ── 2. Nueva tabla de asignaciones ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tools.assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Código correlativo: ASG-000001
        assignment_code VARCHAR(15) UNIQUE NOT NULL,

        tool_id UUID NOT NULL REFERENCES tools.tools(id),
        employee_id UUID NOT NULL REFERENCES employees.employee_records(id),

        -- Quién asignó. El nombre va como snapshot para que el histórico no
        -- cambie si después esa persona sale del catálogo o se renombra.
        assigned_by_id UUID REFERENCES auth.users(id),
        assigned_by_name VARCHAR(200),

        assignment_date DATE NOT NULL DEFAULT CURRENT_DATE,
        revocation_date DATE,
        last_used_date DATE,

        -- 'activo' | 'revocado'
        status VARCHAR(20) NOT NULL DEFAULT 'activo',

        -- Auditoría ISO 27001
        notes TEXT,
        revocation_reason TEXT,

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS tools.assignment_number_seq
        START 1 INCREMENT 1 MINVALUE 1
    `);

    // Una persona no puede tener la misma herramienta activa dos veces.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_active_assignment
        ON tools.assignments(tool_id, employee_id)
        WHERE revocation_date IS NULL AND deleted_at IS NULL
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_assignments_tool ON tools.assignments(tool_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_assignments_employee ON tools.assignments(employee_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_assignments_status ON tools.assignments(status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_assignments_last_used ON tools.assignments(last_used_date)`,
    );

    // ── 3. Catálogo de asignadores ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tools.assigners (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
        employee_id UUID REFERENCES employees.employee_records(id),
        display_name VARCHAR(200) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Semilla: Paulo y Daniel. COALESCE porque el usuario puede no tener
    // expediente en RRHH todavía y display_name es NOT NULL.
    await queryRunner.query(`
      INSERT INTO tools.assigners (user_id, employee_id, display_name)
      SELECT u.id, e.id, COALESCE(e.full_name, u.name, u.email)
      FROM auth.users u
      LEFT JOIN employees.employee_records e ON e.corporate_email = u.email
      WHERE u.email IN ('paulo@lievant.com', 'daniel.ortiz@lievant.com')
        AND NOT EXISTS (SELECT 1 FROM tools.assigners a WHERE a.user_id = u.id)
    `);

    // ── 4. Permisos ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('transformacion', 'asignaciones', 'read', 'Ver asignaciones de herramientas'),
        ('transformacion', 'asignaciones', 'write', 'Gestionar asignaciones de herramientas')
      ON CONFLICT (section, module, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'DIRECTOR')
        AND p.section = 'transformacion' AND p.module = 'asignaciones'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    // Los permisos de 'licencias' se quedan: la tabla vieja sobrevive
    // renombrada y borrarlos dejaría sin acceso a quien los tenga asignados
    // mientras se decide si el histórico se migra o se archiva.

    // ── 5. Flujo de notificación ────────────────────────────────────────────
    // El destinatario NO se hardcodea a "coordinador TI": se configura en
    // /admin/flujos-notificacion como el resto. Sin destinatarios el notify()
    // es un no-op, así que el módulo funciona desde el día uno.
    await queryRunner.query(`
      INSERT INTO notifications.notification_flows (module, event, name, description) VALUES
        ('transformacion', 'asignacion_requiere_aprobacion',
         'Asignaciones — Herramienta que requiere aprobación',
         'Se dispara al asignar una herramienta marcada como requires_approval')
      ON CONFLICT (module, event) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM notifications.notification_flows
      WHERE module = 'transformacion' AND event = 'asignacion_requiere_aprobacion'
    `);

    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions
        WHERE section = 'transformacion' AND module = 'asignaciones'
      )
    `);
    await queryRunner.query(`
      DELETE FROM auth.permissions
      WHERE section = 'transformacion' AND module = 'asignaciones'
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS tools.assigners`);
    await queryRunner.query(`DROP TABLE IF EXISTS tools.assignments`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS tools.assignment_number_seq`);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS tools.tool_assignments_deprecated_20260918
        RENAME TO tool_assignments
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS tools.licenses_deprecated_20260918
        RENAME TO licenses
    `);
  }
}
