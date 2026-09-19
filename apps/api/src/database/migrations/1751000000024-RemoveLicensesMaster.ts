import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Retiro del Maestro de Licenciamientos.
 *
 * El schema `licenses` (tool_catalog, employee_licenses, tool_assignments)
 * modelaba la matriz de acceso sí/no por colaborador. Queda sustituido por
 * `tools.assignments`, que registra lo mismo con folio, fechas y auditoría.
 *
 * El DROP es CASCADE y destructivo: se lleva las tres tablas y sus datos, y
 * esta migración NO tiene down() que los recupere —solo puede recrear el
 * esqueleto vacío—. Es lo que se pidió explícitamente; el respaldo, si hace
 * falta, tiene que existir fuera de la base antes de correrla.
 *
 * Lo que se pierde y no tiene equivalente en el módulo nuevo:
 * `employee_licenses.active_directory_name` y `.responsiva`. El resto —qué
 * herramienta tiene cada persona— vive ahora en tools.assignments.
 *
 * Se borran también dos juegos de permisos que quedan apuntando a endpoints
 * inexistentes: 'transformacion.licenciamientos' (de este maestro) y
 * 'transformacion.licencias' (de tools.licenses, depreciada en la migración
 * 23). Un permiso huérfano solo ensucia la pantalla de roles.
 *
 * 'rrhh.empleados.licencias' SÍ se conserva: la pestaña "Equipos y Licencias"
 * del expediente sigue existiendo, ahora alimentada por
 * GET /assignments/by-employee/:id.
 */
export class RemoveLicensesMaster1751000000024 implements MigrationInterface {
  name = 'RemoveLicensesMaster1751000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA IF EXISTS licenses CASCADE`);

    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions
        WHERE section = 'transformacion' AND module IN ('licenciamientos', 'licencias')
      )
    `);
    await queryRunner.query(`
      DELETE FROM auth.user_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions
        WHERE section = 'transformacion' AND module IN ('licenciamientos', 'licencias')
      )
    `);
    await queryRunner.query(`
      DELETE FROM auth.permissions
      WHERE section = 'transformacion' AND module IN ('licenciamientos', 'licencias')
    `);
  }

  /**
   * Reversión parcial: recrea el esqueleto vacío para que la base vuelva a ser
   * estructuralmente válida, pero los datos del maestro no se recuperan desde
   * aquí. No se restauran los permisos borrados porque no habría pantalla que
   * los consumiera.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS licenses`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS licenses.tool_catalog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        category VARCHAR(50) DEFAULT 'software',
        icon VARCHAR(50) DEFAULT 'ti-app',
        color VARCHAR(20) DEFAULT '#666666',
        is_active BOOLEAN DEFAULT true,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

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

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS licenses.tool_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_license_id UUID NOT NULL REFERENCES licenses.employee_licenses(id),
        tool_id UUID NOT NULL REFERENCES licenses.tool_catalog(id),
        has_access BOOLEAN DEFAULT false,
        is_admin BOOLEAN DEFAULT false,
        granted_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        notes TEXT
      )
    `);
  }
}
