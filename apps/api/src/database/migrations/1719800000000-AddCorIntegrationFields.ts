import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCorIntegrationFields1719800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE clients.client_records
        ADD COLUMN IF NOT EXISTS cor_synced_at   TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS cor_sync_status VARCHAR(20) DEFAULT 'pending'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_client_records_cor_id
        ON clients.client_records(cor_id)
        WHERE cor_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS clients.idx_client_records_cor_id`);
    await queryRunner.query(`
      ALTER TABLE clients.client_records
        DROP COLUMN IF EXISTS cor_synced_at,
        DROP COLUMN IF EXISTS cor_sync_status
    `);
  }
}
