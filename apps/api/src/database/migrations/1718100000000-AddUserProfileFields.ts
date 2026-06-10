import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserProfileFields1718100000000 implements MigrationInterface {
  name = 'AddUserProfileFields1718100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE auth.users
        ADD COLUMN location VARCHAR(50),
        ADD COLUMN mfa_enabled BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN last_login_at TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE auth.users
        DROP COLUMN location,
        DROP COLUMN mfa_enabled,
        DROP COLUMN last_login_at
    `);
  }
}
