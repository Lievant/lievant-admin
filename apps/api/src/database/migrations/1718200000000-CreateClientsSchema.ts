import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClientsSchema1718200000000 implements MigrationInterface {
  name = 'CreateClientsSchema1718200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS clients`);

    await queryRunner.query(`
      CREATE TABLE clients.groups (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(200) NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW(),
        deleted_at  TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE clients.companies (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id    UUID REFERENCES clients.groups(id) ON DELETE SET NULL,
        name        VARCHAR(200) NOT NULL,
        legal_name  VARCHAR(300),
        rfc         VARCHAR(20) UNIQUE,
        industry    VARCHAR(100),
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW(),
        deleted_at  TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE clients.brands (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id  UUID NOT NULL REFERENCES clients.companies(id) ON DELETE CASCADE,
        name        VARCHAR(200) NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW(),
        deleted_at  TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE clients.client_records (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        display_id          VARCHAR(20) UNIQUE NOT NULL,
        group_id            UUID REFERENCES clients.groups(id) ON DELETE SET NULL,
        primary_company_id  UUID NOT NULL REFERENCES clients.companies(id),
        status              VARCHAR(20) NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'paused', 'lost')),
        account_manager_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        notes               TEXT,
        crm_id              VARCHAR(100),
        cor_id              VARCHAR(100),
        contpaq_id          VARCHAR(100),
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_at          TIMESTAMPTZ DEFAULT NOW(),
        deleted_at          TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE clients.financial_data (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_record_id UUID UNIQUE NOT NULL REFERENCES clients.client_records(id) ON DELETE CASCADE,
        payment_days      INT,
        billing_email     VARCHAR(200),
        billing_contact   VARCHAR(200),
        credit_limit      DECIMAL(12,2),
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE clients.documents (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_record_id UUID NOT NULL REFERENCES clients.client_records(id) ON DELETE CASCADE,
        document_type     VARCHAR(100) NOT NULL,
        file_name         VARCHAR(300) NOT NULL,
        file_path         VARCHAR(500) NOT NULL,
        status            VARCHAR(20) NOT NULL DEFAULT 'uploaded'
                            CHECK (status IN ('uploaded', 'pending', 'missing')),
        version           INT NOT NULL DEFAULT 1,
        uploaded_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_clients_companies_group_id ON clients.companies(group_id)`);
    await queryRunner.query(`CREATE INDEX idx_clients_brands_company_id ON clients.brands(company_id)`);
    await queryRunner.query(`CREATE INDEX idx_clients_client_records_group_id ON clients.client_records(group_id)`);
    await queryRunner.query(`CREATE INDEX idx_clients_client_records_status ON clients.client_records(status)`);
    await queryRunner.query(
      `CREATE INDEX idx_clients_client_records_account_manager_id ON clients.client_records(account_manager_id)`,
    );
    await queryRunner.query(`CREATE INDEX idx_clients_documents_client_record_id ON clients.documents(client_record_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS clients.documents`);
    await queryRunner.query(`DROP TABLE IF EXISTS clients.financial_data`);
    await queryRunner.query(`DROP TABLE IF EXISTS clients.client_records`);
    await queryRunner.query(`DROP TABLE IF EXISTS clients.brands`);
    await queryRunner.query(`DROP TABLE IF EXISTS clients.companies`);
    await queryRunner.query(`DROP TABLE IF EXISTS clients.groups`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS clients CASCADE`);
  }
}
