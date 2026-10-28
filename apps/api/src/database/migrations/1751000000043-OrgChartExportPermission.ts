import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Organigrama: permiso para exportar a PDF (`rrhh.organigrama.export`).
 *
 * Solo la fila del permiso y su asignación por rol a SUPER_ADMIN. A RRHH se le da por usuario
 * (como `rrhh.matriz-puestos.approve`). El organigrama en sí sigue visible para cualquier usuario autenticado.
 *
 * Aditiva e idempotente; `down()` quita el permiso y sus asignaciones.
 */
export class OrgChartExportPermission1751000000043 implements MigrationInterface {
  name = 'OrgChartExportPermission1751000000043';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES ('rrhh', 'organigrama', 'export', 'Exportar el Organigrama a PDF')
      ON CONFLICT (section, module, action) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE p.section = 'rrhh' AND p.module = 'organigrama' AND p.action = 'export' AND r.name = 'SUPER_ADMIN'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const ids = `SELECT id FROM auth.permissions WHERE section = 'rrhh' AND module = 'organigrama' AND action = 'export'`;
    await queryRunner.query(`DELETE FROM auth.user_permissions WHERE permission_id IN (${ids})`);
    await queryRunner.query(`DELETE FROM auth.role_permissions WHERE permission_id IN (${ids})`);
    await queryRunner.query(`DELETE FROM auth.permissions WHERE section = 'rrhh' AND module = 'organigrama' AND action = 'export'`);
  }
}
