import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnnouncementEventDate1719100000000 implements MigrationInterface {
  name = 'AddAnnouncementEventDate1719100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE auth.announcements
        ADD COLUMN IF NOT EXISTS event_date DATE
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE auth.announcements
        DROP COLUMN IF EXISTS event_date
    `);
  }
}
