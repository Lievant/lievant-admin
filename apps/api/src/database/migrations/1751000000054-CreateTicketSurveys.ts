import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Soporte TI: encuesta de satisfacción al cerrar un ticket.
 *
 *  - `helpdesk.ticket_surveys`: una respuesta por ticket (UNIQUE ticket_id), de solo inserción (no hay endpoint para
 *    editar ni borrar). `answered_by_name` es un snapshot. `helpdesk.tickets.id` es UUID.
 *  - Flujo `helpdesk.encuesta_respondida` en notifications.notification_flows (aviso al coordinador) con, como
 *    destinatario inicial, el expediente del usuario daniel.ortiz@lievant.com (recipient_type 'empleado', que es como
 *    el flujo resuelve personas concretas). Si ese usuario o su expediente no existen en el ambiente, no se inserta el
 *    destinatario y la migración no falla; se agrega después desde el panel de flujos.
 *
 * Aditiva e idempotente. DESPLIEGUE: primero esta migración y después el código. `down()` borra el flujo, su
 * destinatario y la tabla con las respuestas.
 */
export class CreateTicketSurveys1751000000054 implements MigrationInterface {
  name = 'CreateTicketSurveys1751000000054';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS helpdesk.ticket_surveys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL UNIQUE REFERENCES helpdesk.tickets(id),
        rating VARCHAR(10) NOT NULL CHECK (rating IN ('feliz','normal','triste','enojado')),
        comment VARCHAR(1000),
        answered_by UUID REFERENCES auth.users(id),
        answered_by_name VARCHAR(200) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      INSERT INTO notifications.notification_flows (module, event, name, description) VALUES
        ('helpdesk', 'encuesta_respondida', 'HelpDesk — Encuesta de satisfacción respondida',
         'Se dispara cuando el solicitante califica la atención de un ticket cerrado')
      ON CONFLICT (module, event) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO notifications.flow_recipients (flow_id, recipient_type, employee_id, notification_type, sort_order, label)
      SELECT f.id, 'empleado', e.id, 'informativa', 0, 'Coordinación de Soporte TI'
      FROM notifications.notification_flows f
      JOIN auth.users u ON lower(u.email) = 'daniel.ortiz@lievant.com'
      JOIN employees.employee_records e ON e.auth_user_id = u.id AND e.deleted_at IS NULL
      WHERE f.module = 'helpdesk' AND f.event = 'encuesta_respondida'
        AND NOT EXISTS (
          SELECT 1 FROM notifications.flow_recipients r WHERE r.flow_id = f.id AND r.employee_id = e.id
        )
      LIMIT 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // flow_recipients cae por ON DELETE CASCADE.
    await queryRunner.query(`
      DELETE FROM notifications.notification_flows WHERE module = 'helpdesk' AND event = 'encuesta_respondida'
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS helpdesk.ticket_surveys`);
  }
}
