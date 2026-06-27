import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixDocumentTypesUniqueConstraint1719400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE catalogs.document_types DROP CONSTRAINT document_types_name_key`,
    );
    await queryRunner.query(
      `ALTER TABLE catalogs.document_types ADD CONSTRAINT document_types_name_applies_to_key UNIQUE (name, applies_to)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE catalogs.document_types DROP CONSTRAINT document_types_name_applies_to_key`,
    );
    await queryRunner.query(
      `ALTER TABLE catalogs.document_types ADD CONSTRAINT document_types_name_key UNIQUE (name)`,
    );
  }
}
