import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Corrige el drift de esquema en helpdesk.ticket_attachments.
 *
 * CreateHelpDeskModule1719300000000 creó la tabla con la columna `name`.
 * AddTicketAttachmentsTable1720300000000 la volvió a declarar con `file_name`,
 * pero usando `CREATE TABLE IF NOT EXISTS`: como la tabla ya existía, esa
 * migración quedó registrada como aplicada sin hacer nada, y la columna nunca
 * se renombró. La entidad TicketAttachment mapea `file_name`, así que en
 * cualquier base donde corrieron ambas migraciones el detalle de ticket
 * responde 500 con "column TicketAttachment.file_name does not exist".
 *
 * Idempotente: solo renombra si existe `name` y no existe `file_name`, para no
 * romper los ambientes que ya fueron parcheados a mano.
 */
export class FixTicketAttachmentsFileNameColumn1751000000006 implements MigrationInterface {
  name = 'FixTicketAttachmentsFileNameColumn1751000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'helpdesk'
            AND table_name = 'ticket_attachments'
            AND column_name = 'name'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'helpdesk'
            AND table_name = 'ticket_attachments'
            AND column_name = 'file_name'
        ) THEN
          ALTER TABLE helpdesk.ticket_attachments RENAME COLUMN name TO file_name;
        END IF;
      END $$;
    `);

    // El índice sí se creó en su momento (era una sentencia aparte), pero se
    // reafirma por si algún ambiente quedó sin él.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ticket_attachments
        ON helpdesk.ticket_attachments(ticket_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'helpdesk'
            AND table_name = 'ticket_attachments'
            AND column_name = 'file_name'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'helpdesk'
            AND table_name = 'ticket_attachments'
            AND column_name = 'name'
        ) THEN
          ALTER TABLE helpdesk.ticket_attachments RENAME COLUMN file_name TO name;
        END IF;
      END $$;
    `);
  }
}
