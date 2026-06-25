import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPermissionsGranular1718800000000 implements MigrationInterface {
  name = 'AddPermissionsGranular1718800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Agregar columna section
    await queryRunner.query(`
      ALTER TABLE auth.permissions ADD COLUMN section VARCHAR(50)
    `);

    // 2. Reemplazar unique constraint por uno que incluya section
    await queryRunner.query(`
      ALTER TABLE auth.permissions
        DROP CONSTRAINT IF EXISTS permissions_module_action_key
    `);
    await queryRunner.query(`
      ALTER TABLE auth.permissions
        ADD CONSTRAINT permissions_section_module_action_key
        UNIQUE (section, module, action)
    `);

    // 3. Tabla de permisos directos por usuario (override sobre los del rol)
    await queryRunner.query(`
      CREATE TABLE auth.user_permissions (
        id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID         NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
        permission_id UUID         NOT NULL REFERENCES auth.permissions(id)  ON DELETE CASCADE,
        granted       BOOLEAN      NOT NULL DEFAULT true,
        granted_by    UUID         REFERENCES auth.users(id),
        granted_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, permission_id)
      )
    `);

    // 4. Seed de permisos del sistema
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description) VALUES
        -- Finanzas
        ('finanzas', 'clientes',             'read',  'Ver módulo de clientes'),
        ('finanzas', 'clientes',             'write', 'Crear y editar clientes'),
        ('finanzas', 'clientes.financiero',  'read',  'Ver tab financiero de clientes'),
        ('finanzas', 'clientes.documentos',  'read',  'Ver documentos de clientes'),
        ('finanzas', 'proveedores',          'read',  'Ver módulo de proveedores'),
        ('finanzas', 'proveedores',          'write', 'Crear y editar proveedores'),
        ('finanzas', 'proveedores.ordenes',  'read',  'Ver órdenes de compra'),
        ('finanzas', 'proveedores.ordenes',  'write', 'Crear órdenes de compra'),
        ('finanzas', 'proveedores.facturas', 'read',  'Ver facturas'),
        ('finanzas', 'proveedores.facturas', 'write', 'Registrar facturas y pagos'),
        ('finanzas', 'proveedores.bancario', 'read',  'Ver datos bancarios de proveedores'),
        -- RRHH
        ('rrhh', 'empleados',            'read',  'Ver módulo de empleados'),
        ('rrhh', 'empleados',            'write', 'Crear y editar empleados'),
        ('rrhh', 'empleados.personal',   'read',  'Ver tab datos personales'),
        ('rrhh', 'empleados.personal',   'write', 'Editar datos personales'),
        ('rrhh', 'empleados.nomina',     'read',  'Ver tab compensación/nómina'),
        ('rrhh', 'empleados.nomina',     'write', 'Editar compensación'),
        ('rrhh', 'empleados.documentos', 'write', 'Generar documentos de RRHH'),
        -- Herramientas
        ('herramientas', 'salas', 'read',  'Ver y reservar salas'),
        ('herramientas', 'salas', 'write', 'Administrar salas'),
        -- Admin
        ('admin', 'usuarios',  'read',  'Ver usuarios del sistema'),
        ('admin', 'usuarios',  'write', 'Crear y editar usuarios'),
        ('admin', 'roles',     'write', 'Gestionar roles y permisos'),
        ('admin', 'catalogos', 'write', 'Gestionar catálogos')
    `);

    // 5. Asignación de permisos por rol

    // SUPER_ADMIN → todos los permisos
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM auth.roles r CROSS JOIN auth.permissions p
        WHERE r.name = 'SUPER_ADMIN'
      ON CONFLICT DO NOTHING
    `);

    // ADMIN_FINANZAS → todos los de finanzas + empleados read sin nomina
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM auth.roles r, auth.permissions p
        WHERE r.name = 'ADMIN_FINANZAS'
          AND (
            p.section = 'finanzas'
            OR (p.section = 'rrhh' AND p.module NOT LIKE '%.nomina%' AND p.action = 'read')
          )
      ON CONFLICT DO NOTHING
    `);

    // ADMIN_RRHH → empleados (todos excepto nomina)
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM auth.roles r, auth.permissions p
        WHERE r.name = 'ADMIN_RRHH'
          AND p.section = 'rrhh'
          AND p.module NOT LIKE '%.nomina%'
      ON CONFLICT DO NOTHING
    `);

    // ADMIN_NOMINA → solo empleados.nomina
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM auth.roles r, auth.permissions p
        WHERE r.name = 'ADMIN_NOMINA'
          AND p.section = 'rrhh'
          AND p.module = 'empleados.nomina'
      ON CONFLICT DO NOTHING
    `);

    // CUENTA_MANAGER → clientes read + proveedores read + salas read
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM auth.roles r, auth.permissions p
        WHERE r.name = 'CUENTA_MANAGER'
          AND (
            (p.section = 'finanzas'      AND p.module IN ('clientes', 'proveedores') AND p.action = 'read')
            OR (p.section = 'herramientas' AND p.module = 'salas' AND p.action = 'read')
          )
      ON CONFLICT DO NOTHING
    `);

    // VIEWER → clientes read + salas read
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM auth.roles r, auth.permissions p
        WHERE r.name = 'VIEWER'
          AND (
            (p.section = 'finanzas'      AND p.module = 'clientes' AND p.action = 'read')
            OR (p.section = 'herramientas' AND p.module = 'salas'   AND p.action = 'read')
          )
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar role_permissions de los permisos seeded
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions WHERE section IS NOT NULL
      )
    `);

    // Eliminar permisos seeded
    await queryRunner.query(`
      DELETE FROM auth.permissions WHERE section IS NOT NULL
    `);

    // Eliminar tabla user_permissions
    await queryRunner.query(`DROP TABLE IF EXISTS auth.user_permissions`);

    // Eliminar unique constraint granular
    await queryRunner.query(`
      ALTER TABLE auth.permissions
        DROP CONSTRAINT IF EXISTS permissions_section_module_action_key
    `);

    // Eliminar columna section
    await queryRunner.query(`
      ALTER TABLE auth.permissions DROP COLUMN IF EXISTS section
    `);
  }
}
