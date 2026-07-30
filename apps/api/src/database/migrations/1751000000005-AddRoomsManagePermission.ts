import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomsManagePermission1751000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES ('herramientas', 'salas', 'manage', 'Gestionar reservas de otros colaboradores')
      ON CONFLICT DO NOTHING
    `);

    // Solo SUPER_ADMIN por defecto. DIRECTOR y COLABORADOR reciben el resto de
    // permisos de 'herramientas' por rol (ver ReformPermissionsSystem), asi que
    // 'manage' se concede de forma explicita y no por el barrido de seccion.
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM auth.roles r, auth.permissions p
      WHERE r.name = 'SUPER_ADMIN'
        AND p.section = 'herramientas'
        AND p.module = 'salas'
        AND p.action = 'manage'
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
        SELECT id FROM auth.permissions
        WHERE section = 'herramientas' AND module = 'salas' AND action = 'manage'
      )
    `);
    await queryRunner.query(`
      DELETE FROM auth.user_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions
        WHERE section = 'herramientas' AND module = 'salas' AND action = 'manage'
      )
    `);
    await queryRunner.query(`
      DELETE FROM auth.permissions
      WHERE section = 'herramientas' AND module = 'salas' AND action = 'manage'
    `);
  }
}
