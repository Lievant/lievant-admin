import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Motor de flujos de notificación.
 *
 * Hasta ahora cada módulo decidía en código a quién avisar. Eso obliga a un
 * deploy para cambiar un destinatario, que es una decisión de negocio (RRHH
 * quiere enterarse de las aprobaciones, mañana también Dirección). Estas dos
 * tablas mueven esa decisión a datos: el módulo dispara `(module, event)` y el
 * flujo resuelve a quién le llega.
 *
 * `recipient_type` es un discriminador, no una FK: 'jefe_inmediato' y
 * 'solicitante' se resuelven contra el contexto del evento —no hay un id que
 * guardar—, mientras que 'empleado' usa employee_id y 'permiso' usa
 * permission_key. Por eso ambas columnas son nullable y la coherencia se valida
 * en el servicio, no con un CHECK: un CHECK obligaría a migrar la tabla cada vez
 * que aparezca un tipo nuevo.
 */
export class CreateNotificationFlows1751000000009 implements MigrationInterface {
  name = 'CreateNotificationFlows1751000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notifications.notification_flows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        module VARCHAR(50) NOT NULL,
        event VARCHAR(50) NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_notification_flows_module_event UNIQUE (module, event)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notifications.flow_recipients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        flow_id UUID NOT NULL REFERENCES notifications.notification_flows(id) ON DELETE CASCADE,

        -- 'jefe_inmediato' | 'solicitante' | 'empleado' | 'permiso'
        recipient_type VARCHAR(30) NOT NULL,

        employee_id UUID REFERENCES employees.employee_records(id),
        permission_key VARCHAR(100),

        -- 'informativa' | 'accion' | 'accion_con_nota'
        notification_type VARCHAR(20) DEFAULT 'informativa',

        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Índice nombrado: el que genera `CREATE INDEX ON tabla(col)` recibe un
    // nombre automático que el down() no puede borrar de forma determinista.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_flow_recipients_flow ON notifications.flow_recipients(flow_id)`,
    );

    await queryRunner.query(`
      INSERT INTO notifications.notification_flows (module, event, name, description) VALUES
        ('vacaciones', 'solicitud_creada', 'Vacaciones — Solicitud creada',
         'Se dispara cuando un colaborador crea una solicitud de vacaciones'),
        ('vacaciones', 'solicitud_aprobada', 'Vacaciones — Solicitud aprobada',
         'Se dispara cuando el jefe aprueba las vacaciones'),
        ('vacaciones', 'solicitud_rechazada', 'Vacaciones — Solicitud rechazada',
         'Se dispara cuando el jefe rechaza las vacaciones'),
        ('helpdesk', 'ticket_creado', 'Soporte TI — Ticket creado',
         'Se dispara cuando se crea un nuevo ticket de soporte'),
        ('helpdesk', 'ticket_resuelto', 'Soporte TI — Ticket resuelto',
         'Se dispara cuando se resuelve un ticket de soporte')
      ON CONFLICT (module, event) DO NOTHING
    `);

    // La pantalla de configuración de flujos se protege con este permiso, que
    // todavía no existía en el catálogo.
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES ('admin', 'configuracion', 'write', 'Configurar flujos de notificación')
      ON CONFLICT (section, module, action) DO NOTHING
    `);

    // Solo SUPER_ADMIN por defecto: define a quién le llega qué en toda la
    // plataforma, así que se otorga a mano a quien deba tenerlo.
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name = 'SUPER_ADMIN'
        AND p.section = 'admin' AND p.module = 'configuracion' AND p.action = 'write'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions
        WHERE section = 'admin' AND module = 'configuracion' AND action = 'write'
      )
    `);

    await queryRunner.query(`
      DELETE FROM auth.permissions
      WHERE section = 'admin' AND module = 'configuracion' AND action = 'write'
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS notifications.idx_flow_recipients_flow`);
    // flow_recipients cae por el ON DELETE CASCADE, pero se borra explícito para
    // no depender del orden de drop.
    await queryRunner.query(`DROP TABLE IF EXISTS notifications.flow_recipients`);
    await queryRunner.query(`DROP TABLE IF EXISTS notifications.notification_flows`);
  }
}
