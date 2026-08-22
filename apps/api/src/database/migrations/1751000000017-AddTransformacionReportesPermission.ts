import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permiso transformacion.reportes.read para el reporte Control de Documentos
 * por Entidad.
 *
 * El permiso NO existía: la sección 'transformacion' solo tenía inventario,
 * licenciamientos, tickets.gestion y tickets.reportes. Un decorador que exige
 * un permiso inexistente deja el endpoint accesible únicamente para SUPER_ADMIN
 * —que bypasea el guard—, que es exactamente el bug que tuvo el Maestro de
 * Vacaciones, así que aquí se crea junto con sus asignaciones de rol.
 *
 * Se asigna a SUPER_ADMIN y DIRECTOR: es un reporte de control transversal
 * sobre expedientes de empleados, clientes y proveedores, no una vista de
 * autoservicio para cualquier colaborador.
 */
export class AddTransformacionReportesPermission1751000000017 implements MigrationInterface {
  name = 'AddTransformacionReportesPermission1751000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES ('transformacion', 'reportes', 'read',
              'Ver reportes de Transformación Digital (control de documentos)')
      ON CONFLICT (section, module, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'DIRECTOR')
        AND p.section = 'transformacion' AND p.module = 'reportes' AND p.action = 'read'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions
        WHERE section = 'transformacion' AND module = 'reportes' AND action = 'read'
      )
    `);

    await queryRunner.query(`
      DELETE FROM auth.permissions
      WHERE section = 'transformacion' AND module = 'reportes' AND action = 'read'
    `);
  }
}
