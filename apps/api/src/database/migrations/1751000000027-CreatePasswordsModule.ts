import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Administración de Contraseñas (TIC-RE-17, clasificación C3).
 *
 * La contraseña se guarda cifrada con pgcrypto (`pgp_sym_encrypt` con
 * `cipher-algo=aes256`); la llave vive en PASSWORDS_ENCRYPTION_KEY y nunca
 * toca la base. `password_iv` queda solo por compatibilidad con el formato del
 * registro: el mensaje OpenPGP ya lleva su propia sal y vector, así que la
 * columna no se llena.
 *
 * `reveal_log` es la bitácora de quién vio o copió cada contraseña. Sirve
 * también de contador para el límite de 10 reveals por hora: al vivir en la
 * base, el límite es el mismo sin importar cuántas tasks de ECS atiendan.
 *
 * Los índices llevan nombre e IF NOT EXISTS para que la migración se pueda
 * reintentar en un entorno donde quedó a medias.
 */
export class CreatePasswordsModule1751000000027 implements MigrationInterface {
  name = 'CreatePasswordsModule1751000000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Antes que nada: las columnas cifradas dependen de pgp_sym_encrypt.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS passwords`);

    // ── Catálogo de aplicaciones ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS passwords.applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL UNIQUE,
        category VARCHAR(100),
        icon_url VARCHAR(500),
        is_active BOOLEAN NOT NULL DEFAULT true,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // UNIQUE(name) distingue mayúsculas; este índice es el que impide
    // "Canva" y "canva" a la vez, que es lo que "homologado" significa.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_password_applications_lower_name
        ON passwords.applications (LOWER(name))
    `);

    await queryRunner.query(`
      INSERT INTO passwords.applications (name, category, sort_order) VALUES
        ('Mercado Libre', 'E-commerce', 1),
        ('Amazon Ads', 'E-commerce', 2),
        ('Amazon Seller Central', 'E-commerce', 3),
        ('Meta Business Suite', 'Marketing Digital', 4),
        ('Google Ads', 'Marketing Digital', 5),
        ('Google Analytics', 'Marketing Digital', 6),
        ('Google Search Console', 'Marketing Digital', 7),
        ('Canva', 'Diseño', 8),
        ('Adobe Creative Cloud', 'Diseño', 9),
        ('Hootsuite', 'Redes Sociales', 10),
        ('Klaviyo', 'Marketing Digital', 11),
        ('Shopify', 'E-commerce', 12),
        ('WooCommerce', 'E-commerce', 13),
        ('TikTok for Business', 'Redes Sociales', 14),
        ('LinkedIn Ads', 'Redes Sociales', 15),
        ('Mailchimp', 'Marketing Digital', 16),
        ('Semrush', 'Marketing Digital', 17),
        ('HubSpot', 'CRM', 18),
        ('Notion', 'Productividad', 19),
        ('Slack', 'Comunicación', 20),
        ('Zoom', 'Comunicación', 21),
        ('Dropbox', 'Almacenamiento', 22),
        ('Otra', 'Otro', 99)
      ON CONFLICT (name) DO NOTHING
    `);

    // ── Contraseñas ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS passwords.account_passwords (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        record_number SERIAL,
        application_id UUID NOT NULL REFERENCES passwords.applications(id),
        employee_id UUID NOT NULL REFERENCES employees.employee_records(id),
        manager_id UUID NOT NULL REFERENCES employees.employee_records(id),
        username VARCHAR(500) NOT NULL,
        password_encrypted BYTEA NOT NULL,
        password_iv VARCHAR(100),
        assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
        expiry_date DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'activa'
          CHECK (status IN ('activa', 'revocada', 'vencida')),
        expiry_notified_at TIMESTAMPTZ,
        notes TEXT,
        created_by UUID REFERENCES auth.users(id),
        updated_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_account_passwords_employee
        ON passwords.account_passwords (employee_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_account_passwords_manager
        ON passwords.account_passwords (manager_id)
    `);
    // Parcial: el cron solo recorre cuentas vivas con vencimiento.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_account_passwords_expiry
        ON passwords.account_passwords (expiry_date)
        WHERE expiry_date IS NOT NULL AND deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_account_passwords_status
        ON passwords.account_passwords (status)
    `);

    // ── Bitácora de reveals ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS passwords.reveal_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_password_id UUID NOT NULL REFERENCES passwords.account_passwords(id),
        user_id UUID NOT NULL REFERENCES auth.users(id),
        action VARCHAR(20) NOT NULL DEFAULT 'ver' CHECK (action IN ('ver', 'copiar')),
        ip_address VARCHAR(64),
        revealed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // Sirve el conteo del rate limit (usuario + última hora) y el listado de
    // auditoría, que ordena por fecha.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_password_reveal_log_user_time
        ON passwords.reveal_log (user_id, revealed_at DESC)
    `);

    // ── Permisos ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('herramientas', 'passwords', 'read', 'Ver contraseñas asignadas a su equipo'),
        ('herramientas', 'passwords', 'write', 'Gestionar contraseñas de su equipo')
      ON CONFLICT (section, module, action) DO NOTHING
    `);

    // Solo SUPER_ADMIN y DIRECTOR por defecto. Los jefes con rol COLABORADOR
    // necesitan override individual desde /admin/permisos.
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'DIRECTOR')
        AND p.section = 'herramientas' AND p.module = 'passwords'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    // ── Flujo de notificación ───────────────────────────────────────────────
    // El aviso al jefe asignado se manda directo desde el cron; el flujo solo
    // suma copias a quien se configure en el panel de flujos.
    await queryRunner.query(`
      INSERT INTO notifications.notification_flows (module, event, name, description)
      VALUES ('passwords', 'cuenta_por_vencer', 'Contraseña por vencer',
        'Se notifica al líder cuando una contraseña de su equipo está próxima a vencer')
      ON CONFLICT (module, event) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM notifications.notification_flows
      WHERE module = 'passwords' AND event = 'cuenta_por_vencer'
    `);
    await queryRunner.query(`
      DELETE FROM auth.permissions
      WHERE section = 'herramientas' AND module = 'passwords'
    `);
    // pgcrypto se queda: otros objetos pueden depender de la extensión.
    await queryRunner.query(`DROP SCHEMA IF EXISTS passwords CASCADE`);
  }
}
