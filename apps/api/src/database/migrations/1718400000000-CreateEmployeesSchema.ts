import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmployeesSchema1718400000000 implements MigrationInterface {
  name = 'CreateEmployeesSchema1718400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS employees`);

    await queryRunner.query(`
      CREATE TABLE employees.employee_records (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        display_id          VARCHAR(20) UNIQUE NOT NULL,
        cod_nom             VARCHAR(10),
        company_code        VARCHAR(50) NOT NULL,
        company_name        VARCHAR(100) NOT NULL,
        division            VARCHAR(100),
        area                VARCHAR(100),
        project             VARCHAR(100),
        level               VARCHAR(10),
        position            VARCHAR(200) NOT NULL,
        email_signature     VARCHAR(200),
        location            VARCHAR(100),
        modality            VARCHAR(20)
                              CHECK (modality IN ('presencial', 'hibrido', 'remoto')),
        contract_schema     VARCHAR(50),
        full_name           VARCHAR(300) NOT NULL,
        direct_report_to    VARCHAR(300),
        corporate_email     VARCHAR(200) UNIQUE,
        gender              VARCHAR(20),
        nationality         VARCHAR(100) DEFAULT 'Mexicana',
        seniority_date      DATE,
        contract_type       VARCHAR(50),
        contract_end_date   DATE,
        schedule            VARCHAR(100),
        lunch_time          VARCHAR(50),
        studies             VARCHAR(200),
        status              VARCHAR(20) NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'inactive')),
        auth_user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_at          TIMESTAMPTZ DEFAULT NOW(),
        deleted_at          TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE employees.personal_data (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id       UUID UNIQUE NOT NULL REFERENCES employees.employee_records(id) ON DELETE CASCADE,
        rfc               VARCHAR(13),
        imss_number       VARCHAR(20),
        curp              VARCHAR(18),
        birth_date        DATE,
        blood_type        VARCHAR(5),
        marital_status    VARCHAR(30),
        children          SMALLINT DEFAULT 0,
        phone             VARCHAR(20),
        street            VARCHAR(200),
        ext_number        VARCHAR(20),
        int_number        VARCHAR(20),
        neighborhood      VARCHAR(100),
        postal_code       VARCHAR(10),
        city              VARCHAR(100),
        state             VARCHAR(100),
        main_transport    VARCHAR(100),
        commute_time      VARCHAR(50),
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE employees.compensation (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id             UUID UNIQUE NOT NULL REFERENCES employees.employee_records(id) ON DELETE CASCADE,
        daily_gross_salary      DECIMAL(12,2),
        monthly_gross_salary    DECIMAL(12,2),
        service_payment         DECIMAL(12,2),
        last_salary_change      DATE,
        remote_work_allowance   DECIMAL(12,2),
        grocery_vouchers        DECIMAL(12,2),
        gas_vouchers            DECIMAL(12,2),
        health_insurance        VARCHAR(50),
        phone_allowance         DECIMAL(12,2),
        punctuality_bonus       DECIMAL(12,2),
        other_benefits          TEXT,
        total_gross             DECIMAL(12,2),
        net_estimate            DECIMAL(12,2),
        created_at              TIMESTAMPTZ DEFAULT NOW(),
        updated_at              TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE employees.vacations (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id             UUID NOT NULL REFERENCES employees.employee_records(id) ON DELETE CASCADE,
        year                    SMALLINT NOT NULL,
        opening_balance         DECIMAL(5,1),
        taken                   DECIMAL(5,1) DEFAULT 0,
        closing_balance         DECIMAL(5,1),
        support_activity_days   DECIMAL(5,1) DEFAULT 0,
        notes                   TEXT,
        created_at              TIMESTAMPTZ DEFAULT NOW(),
        updated_at              TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (employee_id, year)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE employees.emergency_contacts (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id   UUID NOT NULL REFERENCES employees.employee_records(id) ON DELETE CASCADE,
        name          VARCHAR(200) NOT NULL,
        relationship  VARCHAR(100),
        phone         VARCHAR(20),
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        deleted_at    TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE employees.termination_data (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id       UUID UNIQUE NOT NULL REFERENCES employees.employee_records(id) ON DELETE CASCADE,
        termination_date  DATE,
        reason            TEXT,
        severance_paid    BOOLEAN DEFAULT false,
        severance_amount  DECIMAL(12,2),
        "references"      TEXT,
        notes             TEXT,
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_employees_company_code ON employees.employee_records(company_code)`);
    await queryRunner.query(`CREATE INDEX idx_employees_status ON employees.employee_records(status)`);
    await queryRunner.query(`CREATE INDEX idx_employees_location ON employees.employee_records(location)`);
    await queryRunner.query(`CREATE INDEX idx_employees_corporate_email ON employees.employee_records(corporate_email)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS employees.termination_data`);
    await queryRunner.query(`DROP TABLE IF EXISTS employees.emergency_contacts`);
    await queryRunner.query(`DROP TABLE IF EXISTS employees.vacations`);
    await queryRunner.query(`DROP TABLE IF EXISTS employees.compensation`);
    await queryRunner.query(`DROP TABLE IF EXISTS employees.personal_data`);
    await queryRunner.query(`DROP TABLE IF EXISTS employees.employee_records`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS employees CASCADE`);
  }
}
