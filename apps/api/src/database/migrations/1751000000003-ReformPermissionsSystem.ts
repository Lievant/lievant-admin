import { MigrationInterface, QueryRunner } from 'typeorm';

const OLD_ROLES = ['ADMIN_FINANZAS', 'ADMIN_RRHH', 'ADMIN_NOMINA', 'CUENTA_MANAGER', 'VIEWER', 'ADMIN'];

export class ReformPermissionsSystem1751000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Permisos nuevos que no existían
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description) VALUES
      ('rrhh', 'comunicados', 'write', 'Publicar comunicados en el tablón'),
      ('finanzas', 'clientes.financiero', 'write', 'Editar información financiera de clientes')
      ON CONFLICT DO NOTHING
    `);

    // 2. Recategorizar tickets básicos (crear/ver) a 'herramientas' — cualquier
    // colaborador puede usar Soporte TI. tickets.gestion y tickets.reportes
    // se quedan en 'transformacion' (solo TD gestiona/ve reportes de todos).
    await queryRunner.query(`
      UPDATE auth.permissions SET section = 'herramientas'
      WHERE module = 'tickets' AND action IN ('read', 'write')
    `);

    // 3. Roles nuevos
    await queryRunner.query(`
      INSERT INTO auth.roles (name, description) VALUES
      ('DIRECTOR', 'Director — solo Herramientas por defecto'),
      ('COLABORADOR', 'Colaborador — solo Herramientas por defecto')
      ON CONFLICT (name) DO NOTHING
    `);

    // 4. Migrar usuarios de roles viejos a COLABORADOR (auth.user_roles es
    // muchos-a-muchos, no una columna role_id en auth.users)
    await queryRunner.query(`
      INSERT INTO auth.user_roles (user_id, role_id)
      SELECT DISTINCT ur.user_id, (SELECT id FROM auth.roles WHERE name = 'COLABORADOR')
      FROM auth.user_roles ur
      JOIN auth.roles r ON r.id = ur.role_id
      WHERE r.name = ANY($1::text[])
      ON CONFLICT DO NOTHING
    `, [OLD_ROLES]);

    await queryRunner.query(`
      DELETE FROM auth.user_roles
      WHERE role_id IN (SELECT id FROM auth.roles WHERE name = ANY($1::text[]))
    `, [OLD_ROLES]);

    // 5. Limpiar role_permissions y eliminar roles viejos
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE role_id IN (SELECT id FROM auth.roles WHERE name = ANY($1::text[]))
    `, [OLD_ROLES]);

    await queryRunner.query(`DELETE FROM auth.roles WHERE name = ANY($1::text[])`, [OLD_ROLES]);

    // 6. DIRECTOR y COLABORADOR: solo permisos de 'herramientas' (isobot,
    // salas, y ahora tickets básicos ya recategorizados en el paso 2)
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE role_id IN (SELECT id FROM auth.roles WHERE name IN ('DIRECTOR', 'COLABORADOR'))
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name IN ('DIRECTOR', 'COLABORADOR')
      AND p.section = 'herramientas'
      ON CONFLICT DO NOTHING
    `);

    // 7. SUPER_ADMIN mantiene/recibe todos los permisos existentes
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name = 'SUPER_ADMIN'
      AND p.id NOT IN (
        SELECT permission_id FROM auth.role_permissions rp
        JOIN auth.roles ro ON ro.id = rp.role_id
        WHERE ro.name = 'SUPER_ADMIN'
      )
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reversión best-effort: los role_permissions originales de los roles
    // viejos no se pueden reconstruir (se borraron en el up), solo se
    // recrean los roles vacíos y se revierte lo estructuralmente reversible.
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE role_id IN (SELECT id FROM auth.roles WHERE name IN ('DIRECTOR', 'COLABORADOR'))
    `);
    await queryRunner.query(`DELETE FROM auth.user_roles
      WHERE role_id IN (SELECT id FROM auth.roles WHERE name IN ('DIRECTOR', 'COLABORADOR'))
    `);
    await queryRunner.query(`DELETE FROM auth.roles WHERE name IN ('DIRECTOR', 'COLABORADOR')`);

    await queryRunner.query(`
      INSERT INTO auth.roles (name, description) VALUES
      ('ADMIN_FINANZAS', 'Restaurado por rollback — sin permisos originales'),
      ('ADMIN_RRHH', 'Restaurado por rollback — sin permisos originales'),
      ('ADMIN_NOMINA', 'Restaurado por rollback — sin permisos originales'),
      ('CUENTA_MANAGER', 'Restaurado por rollback — sin permisos originales'),
      ('VIEWER', 'Restaurado por rollback — sin permisos originales')
      ON CONFLICT (name) DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE auth.permissions SET section = 'transformacion'
      WHERE module = 'tickets' AND action IN ('read', 'write')
    `);

    await queryRunner.query(`
      DELETE FROM auth.permissions WHERE (section, module, action) IN (
        ('rrhh', 'comunicados', 'write'),
        ('finanzas', 'clientes.financiero', 'write')
      )
    `);
  }
}
