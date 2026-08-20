import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Link de Teams en las reservas de sala.
 *
 * Graph ya generaba la reunión de Teams al crear el evento (el body incluía
 * `isOnlineMeeting`), pero `createCalendarEvent` devolvía únicamente el id del
 * evento y el `onlineMeeting.joinUrl` se descartaba. El link existía en Outlook
 * y en la invitación, pero la app nunca lo tuvo, así que no había forma de
 * mostrar un botón para unirse desde Lievant Admin.
 *
 * La columna es nullable y sin backfill: las reservas anteriores no dejaron
 * rastro del joinUrl en ningún lado, y recuperarlo exigiría releer cada evento
 * de Graph uno por uno. Se llena de aquí en adelante.
 *
 * Nota: el timestamp es …016 y no …015 como se planteó, porque
 * 1751000000015-AddHelpdeskNotificationFlows ya ocupa ese número y dos
 * migraciones con el mismo timestamp dejan el orden de ejecución indefinido.
 */
export class AddTeamsMeetingUrl1751000000016 implements MigrationInterface {
  name = 'AddTeamsMeetingUrl1751000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rooms.bookings
      ADD COLUMN IF NOT EXISTS teams_meeting_url VARCHAR(500)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rooms.bookings
      DROP COLUMN IF EXISTS teams_meeting_url
    `);
  }
}
