import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnnouncements1719000000000 implements MigrationInterface {
  name = 'AddAnnouncements1719000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE auth.announcements (
        id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        title      VARCHAR(200) NOT NULL,
        body       TEXT         NOT NULL,
        author_id  UUID         NOT NULL REFERENCES auth.users(id),
        is_active  BOOLEAN      NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_announcements_active
        ON auth.announcements(created_at DESC)
        WHERE deleted_at IS NULL AND is_active = true
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE auth.announcements`);
  }
}
