import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEquipmentLicensesPermissions1751000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('rrhh', 'empleados.equipos', 'read', 'Ver equipos asignados al empleado'),
        ('rrhh', 'empleados.licencias', 'read', 'Ver licencias del empleado')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM auth.roles r, auth.permissions p
      WHERE r.name = 'SUPER_ADMIN'
      AND p.module IN ('empleados.equipos', 'empleados.licencias')
      AND p.id NOT IN (
        SELECT permission_id FROM auth.role_permissions rp
        JOIN auth.roles ro ON ro.id = rp.role_id
        WHERE ro.name = 'SUPER_ADMIN'
      )
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions WHERE module IN ('empleados.equipos', 'empleados.licencias')
      )
    `);
    await queryRunner.query(`
      DELETE FROM auth.permissions WHERE module IN ('empleados.equipos', 'empleados.licencias')
    `);
  }
}
