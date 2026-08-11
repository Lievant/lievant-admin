import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Flujos configurables de HelpDesk para escalación y asignación de tickets.
 *
 * Solo se dan de alta los flujos; los destinatarios se configuran después desde
 * el panel de flujos de notificación. Sin destinatarios, `notify()` no crea
 * nada: las notificaciones directas al director, al solicitante y al técnico no
 * dependen de estas filas, el flujo únicamente suma copias (Dirección, TI).
 */
export class AddHelpdeskNotificationFlows1751000000015 implements MigrationInterface {
  name = 'AddHelpdeskNotificationFlows1751000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO notifications.notification_flows (module, event, name, description) VALUES
        ('helpdesk', 'ticket_escalado', 'HelpDesk — Ticket escalado',
         'Se dispara cuando un ticket es escalado a un director'),
        ('helpdesk', 'ticket_asignado', 'HelpDesk — Ticket asignado a técnico',
         'Se dispara cuando se asigna un técnico a un ticket')
      ON CONFLICT (module, event) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM notifications.notification_flows
      WHERE module = 'helpdesk' AND event IN ('ticket_escalado', 'ticket_asignado')
    `);
  }
}
