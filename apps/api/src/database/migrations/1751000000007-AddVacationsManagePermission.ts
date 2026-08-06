import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gestión manual de vacaciones para RRHH.
 *
 * 1. Permiso rrhh.vacaciones.manage, asignado a SUPER_ADMIN.
 * 2. Columna hr.vacation_requests.created_by_admin: no existía forma de saber
 *    si una solicitud la levantó el propio colaborador o un administrador en su
 *    nombre, y la UI necesita distinguirlo. Default false porque todas las
 *    solicitudes previas entraron por el flujo de autoservicio.
 */
export class AddVacationsManagePermission1751000000007 implements MigrationInterface {
  name = 'AddVacationsManagePermission1751000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES ('rrhh', 'vacaciones', 'manage',
              'Gestionar vacaciones manualmente — crear, aprobar y eliminar solicitudes')
      ON CONFLICT (section, module, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name = 'SUPER_ADMIN'
        AND p.section = 'rrhh' AND p.module = 'vacaciones' AND p.action = 'manage'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    await queryRunner.query(`
      ALTER TABLE hr.vacation_requests
        ADD COLUMN IF NOT EXISTS created_by_admin BOOLEAN NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE hr.vacation_requests DROP COLUMN IF EXISTS created_by_admin
    `);

    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions
        WHERE section = 'rrhh' AND module = 'vacaciones' AND action = 'manage'
      )
    `);

    await queryRunner.query(`
      DELETE FROM auth.permissions
      WHERE section = 'rrhh' AND module = 'vacaciones' AND action = 'manage'
    `);
  }
}
