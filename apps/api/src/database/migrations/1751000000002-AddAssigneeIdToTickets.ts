import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssigneeIdToTickets1751000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE helpdesk.tickets
      ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES helpdesk.ticket_assignees(id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE helpdesk.tickets
      DROP COLUMN IF EXISTS assignee_id
    `);
  }
}
