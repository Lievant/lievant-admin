import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotesToMediaCredentials1721200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE media_control.api_credentials ADD COLUMN IF NOT EXISTS notes TEXT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE media_control.api_credentials DROP COLUMN IF EXISTS notes`,
    );
  }
}
