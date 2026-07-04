import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLicensesModule1720400000000 implements MigrationInterface {
  name = 'CreateLicensesModule1720400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS licenses`);

    // ------------------------------------------------------------------ //
    // Catálogo de herramientas (extensible)
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS licenses.tool_catalog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        category VARCHAR(50) DEFAULT 'software',
        icon VARCHAR(50) DEFAULT 'ti-app',
        color VARCHAR(20) DEFAULT '#666666',
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      INSERT INTO licenses.tool_catalog (name, category, icon, color, sort_order) VALUES
      ('Correo', 'microsoft', 'ti-mail', '#0078D4', 1),
      ('MS Basic', 'microsoft', 'ti-brand-microsoft', '#0078D4', 2),
      ('MS Premium + Teams', 'microsoft', 'ti-brand-teams', '#6264A7', 3),
      ('Aplicaciones MS 365', 'microsoft', 'ti-apps', '#D83B01', 4),
      ('MS Copilot', 'microsoft', 'ti-robot', '#0078D4', 5),
      ('CRM', 'software', 'ti-users-group', '#FF6B35', 6),
      ('COR', 'software', 'ti-chart-bar', '#00B4D8', 7),
      ('Lapzo', 'software', 'ti-school', '#7B2D8B', 8),
      ('Eversign', 'software', 'ti-signature', '#1DB954', 9)
      ON CONFLICT (name) DO NOTHING
    `);

    // ------------------------------------------------------------------ //
    // Registro de licencias por empleado
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS licenses.employee_licenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL UNIQUE REFERENCES employees.employee_records(id),
        active_directory_name VARCHAR(100),
        responsiva VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES auth.users(id),
        updated_by UUID REFERENCES auth.users(id)
      )
    `);

    // ------------------------------------------------------------------ //
    // Asignaciones de herramientas por empleado
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS licenses.tool_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_license_id UUID NOT NULL REFERENCES licenses.employee_licenses(id),
        tool_id UUID NOT NULL REFERENCES licenses.tool_catalog(id),
        has_access BOOLEAN DEFAULT false,
        is_admin BOOLEAN DEFAULT false,
        granted_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        notes TEXT,
        UNIQUE(employee_license_id, tool_id)
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_employee_licenses_employee ON licenses.employee_licenses(employee_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tool_assignments_employee_license ON licenses.tool_assignments(employee_license_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tool_assignments_tool ON licenses.tool_assignments(tool_id)`);

    // ------------------------------------------------------------------ //
    // auth.permissions seed
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
      ('transformacion', 'licenciamientos', 'read',  'Ver maestro de licencias'),
      ('transformacion', 'licenciamientos', 'write', 'Editar licencias de empleados')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM auth.roles r, auth.permissions p
      WHERE r.name = 'SUPER_ADMIN'
      AND p.module = 'licenciamientos'
      AND p.id NOT IN (
        SELECT permission_id FROM auth.role_permissions rp
        JOIN auth.roles ro ON ro.id = rp.role_id
        WHERE ro.name = 'SUPER_ADMIN'
      )
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM auth.permissions WHERE module = 'licenciamientos'`);
    await queryRunner.query(`DROP TABLE IF EXISTS licenses.tool_assignments`);
    await queryRunner.query(`DROP TABLE IF EXISTS licenses.employee_licenses`);
    await queryRunner.query(`DROP TABLE IF EXISTS licenses.tool_catalog`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS licenses`);
  }
}
