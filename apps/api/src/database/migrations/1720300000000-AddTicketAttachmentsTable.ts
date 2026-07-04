import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTicketAttachmentsTable1720300000000 implements MigrationInterface {
  name = 'AddTicketAttachmentsTable1720300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS helpdesk.ticket_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL REFERENCES helpdesk.tickets(id),
        file_name VARCHAR(255) NOT NULL,
        s3_key VARCHAR(500) NOT NULL,
        file_size INTEGER,
        mime_type VARCHAR(100),
        uploaded_by UUID REFERENCES auth.users(id),
        uploaded_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ticket_attachments
        ON helpdesk.ticket_attachments(ticket_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS helpdesk.idx_ticket_attachments`);
    await queryRunner.query(`DROP TABLE IF EXISTS helpdesk.ticket_attachments`);
  }
}
