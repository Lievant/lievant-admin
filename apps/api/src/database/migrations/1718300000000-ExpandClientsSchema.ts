import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandClientsSchema1718300000000 implements MigrationInterface {
  name = 'ExpandClientsSchema1718300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE clients.contacts (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_record_id  UUID NOT NULL REFERENCES clients.client_records(id) ON DELETE CASCADE,
        name              VARCHAR(200) NOT NULL,
        position          VARCHAR(150),
        area              VARCHAR(100),
        contact_type      VARCHAR(50)
                            CHECK (contact_type IN ('financial', 'administrative', 'commercial', 'operational', 'legal', 'direction')),
        email             VARCHAR(200),
        phone             VARCHAR(50),
        mobile            VARCHAR(50),
        is_primary        BOOLEAN NOT NULL DEFAULT false,
        notes             TEXT,
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW(),
        deleted_at        TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_clients_contacts_client_record_id ON clients.contacts(client_record_id)`);

    await queryRunner.query(`
      ALTER TABLE clients.financial_data
        ADD COLUMN currency VARCHAR(10) DEFAULT 'MXN',
        ADD COLUMN payment_method VARCHAR(50),
        ADD COLUMN sat_payment_method VARCHAR(10),
        ADD COLUMN sat_payment_form VARCHAR(10),
        ADD COLUMN sat_cfdi_use VARCHAR(10),
        ADD COLUMN sat_tax_regime VARCHAR(10),
        ADD COLUMN bank_name VARCHAR(100),
        ADD COLUMN bank_account VARCHAR(50),
        ADD COLUMN bank_clabe VARCHAR(20),
        ADD COLUMN contract_start_date DATE,
        ADD COLUMN contract_end_date DATE,
        ADD COLUMN auto_renewal BOOLEAN DEFAULT false,
        ADD COLUMN internal_notes TEXT
    `);

    await queryRunner.query(`
      ALTER TABLE clients.client_records
        ADD COLUMN segment VARCHAR(10) CHECK (segment IN ('A', 'B', 'C')),
        ADD COLUMN nps_score SMALLINT CHECK (nps_score BETWEEN 0 AND 10),
        ADD COLUMN last_contact_date DATE,
        ADD COLUMN dynamics_id VARCHAR(100),
        ADD COLUMN website VARCHAR(300),
        ADD COLUMN linkedin VARCHAR(300),
        ADD COLUMN country VARCHAR(100) DEFAULT 'México',
        ADD COLUMN city VARCHAR(100),
        ADD COLUMN address TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE clients.client_records
        DROP COLUMN IF EXISTS segment,
        DROP COLUMN IF EXISTS nps_score,
        DROP COLUMN IF EXISTS last_contact_date,
        DROP COLUMN IF EXISTS dynamics_id,
        DROP COLUMN IF EXISTS website,
        DROP COLUMN IF EXISTS linkedin,
        DROP COLUMN IF EXISTS country,
        DROP COLUMN IF EXISTS city,
        DROP COLUMN IF EXISTS address
    `);

    await queryRunner.query(`
      ALTER TABLE clients.financial_data
        DROP COLUMN IF EXISTS currency,
        DROP COLUMN IF EXISTS payment_method,
        DROP COLUMN IF EXISTS sat_payment_method,
        DROP COLUMN IF EXISTS sat_payment_form,
        DROP COLUMN IF EXISTS sat_cfdi_use,
        DROP COLUMN IF EXISTS sat_tax_regime,
        DROP COLUMN IF EXISTS bank_name,
        DROP COLUMN IF EXISTS bank_account,
        DROP COLUMN IF EXISTS bank_clabe,
        DROP COLUMN IF EXISTS contract_start_date,
        DROP COLUMN IF EXISTS contract_end_date,
        DROP COLUMN IF EXISTS auto_renewal,
        DROP COLUMN IF EXISTS internal_notes
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS clients.contacts`);
  }
}
