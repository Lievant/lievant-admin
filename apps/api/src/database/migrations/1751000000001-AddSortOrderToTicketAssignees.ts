import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSortOrderToTicketAssignees1751000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE helpdesk.ticket_assignees
      ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE helpdesk.ticket_assignees
      DROP COLUMN IF EXISTS sort_order
    `);
  }
}
