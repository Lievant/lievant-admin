import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueFileNameToIsobotDocuments1720600000000 implements MigrationInterface {
  name = 'AddUniqueFileNameToIsobotDocuments1720600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE isobot.documents ADD CONSTRAINT uq_isobot_documents_file_name UNIQUE (file_name)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE isobot.documents DROP CONSTRAINT uq_isobot_documents_file_name
    `);
  }
}
