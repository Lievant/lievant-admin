import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Logs, auditoría y analytics de uso.
 *
 * Cuatro tablas de hechos y una de configuración, en su propio schema `audit`
 * para que el volumen —que crece con cada escritura de la plataforma— no se
 * mezcle con los datos de negocio ni entre en los respaldos lógicos por schema.
 *
 * `user_email` y `user_name` van duplicados junto al `user_id`: son snapshots.
 * Un log que deja de poder leerse porque borraron al usuario no sirve para
 * auditoría, que es justo cuando se consulta.
 *
 * Los índices de fecha van DESC porque toda consulta del módulo ordena por
 * "lo más reciente primero"; un índice ASC obligaría a Postgres a recorrerlo
 * al revés en cada página.
 *
 * `details`, `changes` y `request_body` son JSONB. Solo `details` lleva índice
 * GIN: es el único donde se filtra por contenido. Indexar los otros dos
 * costaría escritura en cada request para búsquedas que nadie hace.
 */
export class CreateAuditModule1751000000028 implements MigrationInterface {
  name = 'CreateAuditModule1751000000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS audit`);

    // ── Eventos de seguridad ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit.security_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(50) NOT NULL,
        user_id UUID REFERENCES auth.users(id),
        user_email VARCHAR(200),
        ip_address INET,
        user_agent TEXT,
        module VARCHAR(100),
        resource_id VARCHAR(200),
        details JSONB,
        severity VARCHAR(20) NOT NULL DEFAULT 'info',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_security_events_type ON audit.security_events(event_type)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_security_events_user ON audit.security_events(user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_security_events_severity ON audit.security_events(severity)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_security_events_created ON audit.security_events(created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_security_events_details ON audit.security_events USING GIN(details)`,
    );

    // ── Actividad de usuarios ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit.user_activity (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id),
        user_email VARCHAR(200),
        user_name VARCHAR(200),
        department VARCHAR(100),
        action VARCHAR(50) NOT NULL,
        module VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100),
        entity_id VARCHAR(200),
        entity_name VARCHAR(500),
        changes JSONB,
        ip_address INET,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_activity_user ON audit.user_activity(user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_activity_module ON audit.user_activity(module)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_activity_action ON audit.user_activity(action)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_activity_created ON audit.user_activity(created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_activity_department ON audit.user_activity(department)`,
    );

    // ── Errores de plataforma ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit.platform_errors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        error_code VARCHAR(50),
        message TEXT NOT NULL,
        stack_trace TEXT,
        module VARCHAR(100),
        endpoint VARCHAR(500),
        http_method VARCHAR(10),
        http_status INTEGER,
        user_id UUID REFERENCES auth.users(id),
        user_email VARCHAR(200),
        request_body JSONB,
        duration_ms INTEGER,
        environment VARCHAR(20) DEFAULT 'production',
        resolved BOOLEAN DEFAULT false,
        resolved_at TIMESTAMPTZ,
        resolved_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_platform_errors_module ON audit.platform_errors(module)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_platform_errors_status ON audit.platform_errors(http_status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_platform_errors_resolved ON audit.platform_errors(resolved)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_platform_errors_created ON audit.platform_errors(created_at DESC)`,
    );

    // ── Sesiones ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit.user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id),
        user_email VARCHAR(200),
        department VARCHAR(100),
        login_at TIMESTAMPTZ DEFAULT NOW(),
        last_activity_at TIMESTAMPTZ DEFAULT NOW(),
        logout_at TIMESTAMPTZ,
        duration_minutes INTEGER,
        ip_address INET,
        user_agent TEXT,
        modules_visited JSONB DEFAULT '[]'::jsonb
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON audit.user_sessions(user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_sessions_login ON audit.user_sessions(login_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_sessions_department ON audit.user_sessions(department)`,
    );

    // Una sola sesión abierta por usuario: el interceptor la actualiza en cada
    // request y sin esto crearía una fila por pestaña.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_user_sessions_open
        ON audit.user_sessions(user_id)
        WHERE logout_at IS NULL
    `);

    // ── Configuración por módulo ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit.module_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        module VARCHAR(100) NOT NULL UNIQUE,
        display_name VARCHAR(200) NOT NULL,
        audit_enabled BOOLEAN DEFAULT true,
        log_reads BOOLEAN DEFAULT false,
        log_writes BOOLEAN DEFAULT true,
        retention_days INTEGER DEFAULT 365,
        updated_by UUID REFERENCES auth.users(id),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      INSERT INTO audit.module_config (module, display_name, audit_enabled, log_writes, retention_days)
      VALUES
        ('empleados', 'RRHH — Empleados', true, true, 365),
        ('vacaciones', 'RRHH — Vacaciones', true, true, 365),
        ('clientes', 'Finanzas — Clientes', true, true, 730),
        ('proveedores', 'Finanzas — Proveedores', true, true, 730),
        ('reembolsos', 'Finanzas — Reembolsos', true, true, 730),
        ('gastos-tarjeta', 'Finanzas — Gastos Tarjeta', true, true, 730),
        ('tickets', 'HelpDesk — Tickets', true, true, 365),
        ('inventario', 'TD — Inventario', true, true, 365),
        ('asignaciones', 'TD — Asignaciones', true, true, 365),
        ('passwords', 'Herramientas — Contraseñas', true, true, 730),
        ('salas', 'Herramientas — Salas', true, true, 180),
        ('usuarios', 'Admin — Usuarios', true, true, 730),
        ('permisos', 'Admin — Permisos', true, true, 730)
      ON CONFLICT (module) DO NOTHING
    `);

    // ── Permisos ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('admin', 'audit', 'read', 'Ver logs de auditoría y analytics'),
        ('admin', 'audit', 'write', 'Gestionar configuración de logs'),
        ('admin', 'analytics', 'read', 'Ver dashboard de analytics de uso')
      ON CONFLICT (section, module, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'DIRECTOR')
        AND p.section = 'admin'
        AND p.module IN ('audit', 'analytics')
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions
        WHERE section = 'admin' AND module IN ('audit', 'analytics')
      )
    `);
    await queryRunner.query(`
      DELETE FROM auth.permissions
      WHERE section = 'admin' AND module IN ('audit', 'analytics')
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS audit.module_config`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit.user_sessions`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit.platform_errors`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit.user_activity`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit.security_events`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS audit RESTRICT`);
  }
}
