import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAuthSchema1718000000000 implements MigrationInterface {
  name = 'InitAuthSchema1718000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS auth`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      CREATE TABLE auth.users (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email       VARCHAR(255) UNIQUE NOT NULL,
        name        VARCHAR(255) NOT NULL,
        cognito_id  VARCHAR(255) UNIQUE,
        is_active   BOOLEAN DEFAULT true,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW(),
        deleted_at  TIMESTAMPTZ,
        created_by  UUID,
        updated_by  UUID
      )
    `);

    await queryRunner.query(`
      CREATE TABLE auth.roles (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        color       VARCHAR(20),
        is_system   BOOLEAN DEFAULT false,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE auth.permissions (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        module      VARCHAR(100) NOT NULL,
        action      VARCHAR(100) NOT NULL,
        field       VARCHAR(100),
        description TEXT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE auth.role_permissions (
        role_id       UUID REFERENCES auth.roles(id) ON DELETE CASCADE,
        permission_id UUID REFERENCES auth.permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE auth.user_roles (
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        role_id UUID REFERENCES auth.roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
      )
    `);

    await queryRunner.query(`
      INSERT INTO auth.roles (name, description, is_system) VALUES
        ('SUPER_ADMIN', 'Control total del sistema. Solo Paulo Ossa.', true),
        ('ADMIN_FINANZAS', 'Módulos financieros: proveedores, nómina, reportes.', true),
        ('ADMIN_RRHH', 'Módulo RRHH. No puede ver nómina.', true),
        ('ADMIN_NOMINA', 'Solo módulo nómina. Schema aislado.', true),
        ('CUENTA_MANAGER', 'Clientes y cuentas asignadas.', true),
        ('VIEWER', 'Lectura general sin edición.', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS auth.user_roles`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth.role_permissions`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth.permissions`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth.roles`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth.users`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS auth CASCADE`);
  }
}
