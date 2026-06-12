import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCatalogsSchema1718500000000 implements MigrationInterface {
  name = 'CreateCatalogsSchema1718500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS catalogs`);

    await queryRunner.query(`
      CREATE TABLE catalogs.companies (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code        VARCHAR(50) UNIQUE NOT NULL,
        name        VARCHAR(100) NOT NULL,
        is_active   BOOLEAN DEFAULT true,
        sort_order  SMALLINT DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE catalogs.locations (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100) UNIQUE NOT NULL,
        country     VARCHAR(100) DEFAULT 'México',
        is_active   BOOLEAN DEFAULT true,
        sort_order  SMALLINT DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE catalogs.modalities (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(50) UNIQUE NOT NULL,
        is_active   BOOLEAN DEFAULT true,
        sort_order  SMALLINT DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE catalogs.divisions (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name          VARCHAR(100) NOT NULL,
        company_code  VARCHAR(50),
        is_active     BOOLEAN DEFAULT true,
        sort_order    SMALLINT DEFAULT 0,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (name, company_code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE catalogs.areas (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name            VARCHAR(100) NOT NULL,
        division_name   VARCHAR(100),
        company_code    VARCHAR(100),
        is_active       BOOLEAN DEFAULT true,
        sort_order      SMALLINT DEFAULT 0,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE catalogs.contract_schemas (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100) UNIQUE NOT NULL,
        is_active   BOOLEAN DEFAULT true,
        sort_order  SMALLINT DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE catalogs.contract_types (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100) UNIQUE NOT NULL,
        is_active   BOOLEAN DEFAULT true,
        sort_order  SMALLINT DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE catalogs.org_levels (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code        VARCHAR(10) UNIQUE NOT NULL,
        name        VARCHAR(100) NOT NULL,
        is_active   BOOLEAN DEFAULT true,
        sort_order  SMALLINT DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE catalogs.blood_types (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(5) UNIQUE NOT NULL,
        is_active   BOOLEAN DEFAULT true,
        sort_order  SMALLINT DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE catalogs.marital_statuses (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(50) UNIQUE NOT NULL,
        is_active   BOOLEAN DEFAULT true,
        sort_order  SMALLINT DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE catalogs.industries (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100) UNIQUE NOT NULL,
        is_active   BOOLEAN DEFAULT true,
        sort_order  SMALLINT DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE catalogs.document_types (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name          VARCHAR(100) UNIQUE NOT NULL,
        applies_to    VARCHAR(20) DEFAULT 'client',
        is_required   BOOLEAN DEFAULT false,
        is_active     BOOLEAN DEFAULT true,
        sort_order    SMALLINT DEFAULT 0,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX idx_catalog_companies_active ON catalogs.companies(is_active)`);
    await queryRunner.query(`CREATE INDEX idx_catalog_locations_active ON catalogs.locations(is_active)`);
    await queryRunner.query(`CREATE INDEX idx_catalog_modalities_active ON catalogs.modalities(is_active)`);
    await queryRunner.query(`CREATE INDEX idx_catalog_divisions_active ON catalogs.divisions(is_active)`);
    await queryRunner.query(`CREATE INDEX idx_catalog_areas_active ON catalogs.areas(is_active)`);
    await queryRunner.query(`CREATE INDEX idx_catalog_contract_schemas_active ON catalogs.contract_schemas(is_active)`);
    await queryRunner.query(`CREATE INDEX idx_catalog_contract_types_active ON catalogs.contract_types(is_active)`);
    await queryRunner.query(`CREATE INDEX idx_catalog_org_levels_active ON catalogs.org_levels(is_active)`);
    await queryRunner.query(`CREATE INDEX idx_catalog_blood_types_active ON catalogs.blood_types(is_active)`);
    await queryRunner.query(`CREATE INDEX idx_catalog_marital_statuses_active ON catalogs.marital_statuses(is_active)`);
    await queryRunner.query(`CREATE INDEX idx_catalog_industries_active ON catalogs.industries(is_active)`);
    await queryRunner.query(`CREATE INDEX idx_catalog_document_types_active ON catalogs.document_types(is_active)`);

    // Seed: companies
    await queryRunner.query(`
      INSERT INTO catalogs.companies (code, name, sort_order) VALUES
        ('LIEVANT', 'Lievant', 0),
        ('DATABEANS', 'Databeans', 1),
        ('TRICICLO', 'Triciclo', 2),
        ('ESTRATEGIA_MIX', 'Estrategia Mix', 3)
    `);

    // Seed: locations
    await queryRunner.query(`
      INSERT INTO catalogs.locations (name, country, sort_order) VALUES
        ('León', 'México', 0),
        ('Ciudad de México', 'México', 1),
        ('Guadalajara', 'México', 2),
        ('Colombia', 'Colombia', 3),
        ('Estados Unidos', 'Estados Unidos', 4),
        ('Otro', 'México', 5)
    `);

    // Seed: modalities
    await queryRunner.query(`
      INSERT INTO catalogs.modalities (name, sort_order) VALUES
        ('Presencial', 0),
        ('Híbrido', 1),
        ('Remoto', 2)
    `);

    // Seed: divisions
    await queryRunner.query(`
      INSERT INTO catalogs.divisions (name, company_code, sort_order) VALUES
        ('Administración', NULL, 0),
        ('Operaciones', NULL, 1),
        ('Comercial', NULL, 2),
        ('TI', NULL, 3),
        ('Dirección', NULL, 4),
        ('Recursos Humanos', NULL, 5),
        ('Finanzas', NULL, 6)
    `);

    // Seed: contract_schemas
    await queryRunner.query(`
      INSERT INTO catalogs.contract_schemas (name, sort_order) VALUES
        ('SERVICIOS', 0),
        ('NOMINA', 1),
        ('HONORARIOS', 2)
    `);

    // Seed: contract_types
    await queryRunner.query(`
      INSERT INTO catalogs.contract_types (name, sort_order) VALUES
        ('Determinado', 0),
        ('Indeterminado', 1),
        ('Honorarios', 2),
        ('Por obra', 3),
        ('Freelance', 4)
    `);

    // Seed: org_levels
    await queryRunner.query(`
      INSERT INTO catalogs.org_levels (code, name, sort_order) VALUES
        ('I', 'Operativo', 0),
        ('II', 'Especialista', 1),
        ('III', 'Coordinador/Líder', 2),
        ('IV', 'Director/Gerente', 3)
    `);

    // Seed: blood_types
    await queryRunner.query(`
      INSERT INTO catalogs.blood_types (name, sort_order) VALUES
        ('A+', 0),
        ('A-', 1),
        ('B+', 2),
        ('B-', 3),
        ('O+', 4),
        ('O-', 5),
        ('AB+', 6),
        ('AB-', 7)
    `);

    // Seed: marital_statuses
    await queryRunner.query(`
      INSERT INTO catalogs.marital_statuses (name, sort_order) VALUES
        ('Soltero', 0),
        ('Casado', 1),
        ('Divorciado', 2),
        ('Viudo', 3),
        ('Unión libre', 4)
    `);

    // Seed: industries
    await queryRunner.query(`
      INSERT INTO catalogs.industries (name, sort_order) VALUES
        ('Bebidas y alimentos', 0),
        ('Retail', 1),
        ('Tecnología', 2),
        ('Finanzas', 3),
        ('Medios', 4),
        ('Automotriz', 5),
        ('Salud', 6),
        ('Educación', 7),
        ('Gobierno', 8),
        ('Construcción', 9),
        ('Turismo', 10),
        ('Moda', 11),
        ('Entretenimiento', 12),
        ('Otros', 13)
    `);

    // Seed: document_types
    await queryRunner.query(`
      INSERT INTO catalogs.document_types (name, applies_to, sort_order) VALUES
        ('Contrato maestro', 'client', 0),
        ('Constancia fiscal (RFC)', 'client', 1),
        ('Poder notarial', 'client', 2),
        ('NDA', 'client', 3),
        ('Acta constitutiva', 'client', 4),
        ('Adendum', 'client', 5),
        ('Identificación oficial', 'client', 6),
        ('Otro', 'client', 7)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.document_types`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.industries`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.marital_statuses`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.blood_types`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.org_levels`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.contract_types`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.contract_schemas`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.areas`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.divisions`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.modalities`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.locations`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.companies`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS catalogs CASCADE`);
  }
}
