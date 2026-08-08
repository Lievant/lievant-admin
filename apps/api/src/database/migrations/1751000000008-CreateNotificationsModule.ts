import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sistema de Notificaciones transversal.
 *
 * Schema propio `notifications` porque no pertenece a ningún dominio: cualquier
 * módulo (vacaciones, helpdesk, salas…) genera notificaciones y ninguno es dueño
 * de la tabla.
 *
 * `sender_name` existe además de `sender_id` para las notificaciones emitidas
 * por el sistema, que no tienen un usuario detrás y aun así deben mostrar un
 * remitente legible ("Sistema").
 *
 * `entity_id` + `entity_type` son un vínculo polimórfico deliberado —sin FK—
 * hacia el registro que originó la notificación: la fila referenciada vive en
 * hr.vacation_requests, helpdesk.tickets, etc., y una FK real exigiría una
 * columna por módulo.
 */
export class CreateNotificationsModule1751000000008 implements MigrationInterface {
  name = 'CreateNotificationsModule1751000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS notifications`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notifications.notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        recipient_id UUID NOT NULL REFERENCES auth.users(id),

        sender_id UUID REFERENCES auth.users(id),
        sender_name VARCHAR(200),

        title VARCHAR(300) NOT NULL,
        message TEXT NOT NULL,

        -- 'informativa' | 'accion' | 'accion_con_nota'
        type VARCHAR(20) NOT NULL DEFAULT 'informativa',

        -- 'no_leida' | 'leida' | 'aceptada' | 'rechazada'
        status VARCHAR(20) NOT NULL DEFAULT 'no_leida',

        response_note TEXT,
        responded_at TIMESTAMPTZ,
        responded_by UUID REFERENCES auth.users(id),

        module VARCHAR(50),
        entity_id UUID,
        entity_type VARCHAR(50),

        action_url VARCHAR(500),

        email_sent BOOLEAN DEFAULT false,
        email_sent_at TIMESTAMPTZ,

        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    // Índices nombrados: los auto-generados por `CREATE INDEX ON tabla(col)` no
    // se pueden borrar de forma determinista en el down().
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications.notifications(recipient_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications.notifications(status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications.notifications(created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_notifications_module ON notifications.notifications(module)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications.notifications(entity_id)`,
    );

    // El badge del sidebar consulta no leídas por usuario en cada carga; el
    // índice compuesto evita recorrer todo el historial del destinatario.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_recipient_status
        ON notifications.notifications(recipient_id, status)
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES ('herramientas', 'notificaciones', 'read', 'Ver mis notificaciones')
      ON CONFLICT (section, module, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'DIRECTOR', 'COLABORADOR')
        AND p.section = 'herramientas' AND p.module = 'notificaciones' AND p.action = 'read'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions
        WHERE section = 'herramientas' AND module = 'notificaciones' AND action = 'read'
      )
    `);

    await queryRunner.query(`
      DELETE FROM auth.permissions
      WHERE section = 'herramientas' AND module = 'notificaciones' AND action = 'read'
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS notifications.notifications`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS notifications RESTRICT`);
  }
}
