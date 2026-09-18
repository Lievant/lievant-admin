import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Asignación de herramientas a colaboradores + permisos del módulo.
 *
 * `tools.tools` declara `active_assignments_count` y `total_cost_calculated`,
 * así que la tabla que los alimenta tiene que existir en el mismo módulo; sin
 * ella el catálogo nace con dos columnas que nadie puede mover.
 *
 * No reutiliza `licenses.tool_assignments`: esa tabla cuelga de
 * `licenses.employee_licenses` (una fila por colaborador, con su nombre de AD y
 * su responsiva) y modela acceso sí/no en una matriz. Aquí una asignación es un
 * cargo con vigencia —se da de alta, se aprueba, se revoca— y necesita fecha de
 * revocación propia para que el costo histórico no se borre al quitar el acceso.
 *
 * El índice único es parcial (WHERE revoked_at IS NULL): un colaborador no puede
 * tener dos asignaciones vivas de la misma herramienta, pero sí el historial
 * completo de las que tuvo y le quitaron.
 *
 * Los contadores del catálogo los recalcula el servicio dentro de la misma
 * transacción que la asignación, no un trigger: la regla de qué cuenta como
 * asignación activa (estado + revocación + soft delete de la herramienta) vive
 * en un solo lugar y se prueba como código.
 */
export class CreateToolAssignments1751000000020 implements MigrationInterface {
  name = 'CreateToolAssignments1751000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tools.tool_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        tool_id UUID NOT NULL REFERENCES tools.tools(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES employees.employee_records(id) ON DELETE CASCADE,

        -- 'activa' | 'pendiente_aprobacion' | 'revocada'
        status VARCHAR(30) NOT NULL DEFAULT 'activa',

        -- El colaborador administra la herramienta, no solo la usa
        is_admin BOOLEAN NOT NULL DEFAULT false,

        -- Costo distinto al unitario del catálogo (plan diferente, descuento)
        unit_cost_override DECIMAL(14,2),

        notes TEXT,

        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,

        approved_by UUID REFERENCES auth.users(id),
        approved_at TIMESTAMPTZ,

        created_by UUID REFERENCES auth.users(id),
        updated_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tool_assignments_live
        ON tools.tool_assignments(tool_id, employee_id)
        WHERE revoked_at IS NULL
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tool_assignments_tool ON tools.tool_assignments(tool_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tool_assignments_employee ON tools.tool_assignments(employee_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tool_assignments_status ON tools.tool_assignments(status)`,
    );

    // ── Permisos ────────────────────────────────────────────────────────────
    // Se crean junto con el módulo: un @RequirePermission sobre un permiso
    // inexistente deja el endpoint abierto solo para SUPER_ADMIN, que bypasea
    // el guard, y el módulo parecería funcionar hasta que lo abre alguien más.
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('transformacion', 'herramientas', 'read',
         'Ver el catálogo de herramientas y licencias y sus asignaciones'),
        ('transformacion', 'herramientas', 'write',
         'Crear, editar y asignar herramientas y licencias')
      ON CONFLICT (section, module, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'DIRECTOR')
        AND p.section = 'transformacion' AND p.module = 'herramientas'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions
        WHERE section = 'transformacion' AND module = 'herramientas'
      )
    `);

    await queryRunner.query(`
      DELETE FROM auth.permissions
      WHERE section = 'transformacion' AND module = 'herramientas'
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS tools.tool_assignments`);
  }
}
