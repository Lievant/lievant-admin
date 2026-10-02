import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permisos del reporte de Headcount (RRHH · Reportes), clasificado como
 * confidencial.
 *
 * - `rrhh.headcount.read` abre el reporte. Por defecto solo SUPER_ADMIN; a
 *   Claudia Vázquez (RRHH) se le concede con override individual.
 * - `rrhh.headcount.sensitive` agrega las columnas CURP, RFC, IMSS y salario.
 *   No se asigna a nadie: SUPER_ADMIN ya lo tiene por el bypass del guard y el
 *   resto lo recibe desde /admin/permisos cuando haga falta.
 *
 * Todo es idempotente (ON CONFLICT / NOT EXISTS) para poder reintentarla en un
 * entorno donde quedó a medias. Si el usuario de Claudia no existe en el
 * entorno, el override simplemente no se inserta.
 */
export class AddHeadcountPermission1751000000030 implements MigrationInterface {
  name = 'AddHeadcountPermission1751000000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('rrhh', 'headcount', 'read', 'Ver reporte de headcount — Confidencial'),
        ('rrhh', 'headcount', 'sensitive', 'Ver columnas sensibles del headcount (CURP, RFC, IMSS, salario)')
      ON CONFLICT (section, module, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name = 'SUPER_ADMIN'
        AND p.section = 'rrhh' AND p.module = 'headcount' AND p.action = 'read'
        AND NOT EXISTS (
          SELECT 1 FROM auth.role_permissions rp
          WHERE rp.role_id = r.id AND rp.permission_id = p.id
        )
    `);

    await queryRunner.query(`
      INSERT INTO auth.user_permissions (user_id, permission_id, granted)
      SELECT u.id, p.id, true
      FROM auth.users u, auth.permissions p
      WHERE u.email = 'claudia.vazquez@lievant.com'
        AND p.section = 'rrhh' AND p.module = 'headcount' AND p.action = 'read'
        AND NOT EXISTS (
          SELECT 1 FROM auth.user_permissions up
          WHERE up.user_id = u.id AND up.permission_id = p.id
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.user_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions WHERE section = 'rrhh' AND module = 'headcount'
      )
    `);
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions WHERE section = 'rrhh' AND module = 'headcount'
      )
    `);
    await queryRunner.query(`
      DELETE FROM auth.permissions WHERE section = 'rrhh' AND module = 'headcount'
    `);
  }
}
