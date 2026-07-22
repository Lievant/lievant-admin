import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectsModule1720200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS projects`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS projects.project_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        display_id VARCHAR(20) NOT NULL UNIQUE,
        cor_project_id VARCHAR(50),
        pm_code VARCHAR(50),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        project_type VARCHAR(20) NOT NULL DEFAULT 'recurring',
        status VARCHAR(30) NOT NULL DEFAULT 'active',
        client_record_id UUID REFERENCES clients.client_records(id),
        brand_id UUID REFERENCES clients.brands(id),
        primary_business_unit VARCHAR(50),
        project_manager_id UUID REFERENCES employees.employee_records(id),
        start_date DATE,
        end_date DATE,
        cor_synced_at TIMESTAMPTZ,
        cor_sync_status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES auth.users(id),
        deleted_at TIMESTAMPTZ,
        deleted_by UUID REFERENCES auth.users(id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS projects.project_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects.project_records(id),
        employee_id UUID NOT NULL REFERENCES employees.employee_records(id),
        role VARCHAR(100),
        estimated_hours_monthly DECIMAL(8,2),
        start_date DATE,
        end_date DATE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(project_id, employee_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS projects.project_business_units (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects.project_records(id),
        business_unit VARCHAR(50) NOT NULL,
        percentage DECIMAL(5,2) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(project_id, business_unit)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS projects.project_financials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL UNIQUE REFERENCES projects.project_records(id),
        billing_type VARCHAR(20) NOT NULL DEFAULT 'monthly_fee',
        currency VARCHAR(3) DEFAULT 'MXN',
        total_value DECIMAL(14,2),
        monthly_fee DECIMAL(14,2),
        overhead_percentage DECIMAL(5,2) DEFAULT 0,
        has_commission BOOLEAN DEFAULT false,
        commission_percentage DECIMAL(5,2),
        commission_employee_id UUID REFERENCES employees.employee_records(id),
        billing_day INTEGER DEFAULT 1,
        billing_notes TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS projects.project_billing_milestones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects.project_records(id),
        name VARCHAR(200) NOT NULL,
        amount DECIMAL(14,2) NOT NULL,
        due_date DATE,
        invoiced_at TIMESTAMPTZ,
        paid_at TIMESTAMPTZ,
        notes TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS projects.project_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects.project_records(id),
        type VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        s3_key VARCHAR(500) NOT NULL,
        file_size INTEGER,
        uploaded_by UUID REFERENCES auth.users(id),
        uploaded_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS projects.project_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects.project_records(id),
        changed_by_id UUID REFERENCES auth.users(id),
        changed_by_name VARCHAR(200) NOT NULL,
        action VARCHAR(100) NOT NULL,
        field_changed VARCHAR(100),
        old_value TEXT,
        new_value TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      INSERT INTO catalogs.document_types (name, description, applies_to, is_required, is_active, sort_order)
      VALUES
        ('Alta del proyecto', 'Documento de apertura oficial del proyecto', 'project', true, true, 1),
        ('Cotización', 'Propuesta económica aprobada por el cliente', 'project', true, true, 2),
        ('Contrato', 'Contrato de servicios firmado', 'project', false, true, 3),
        ('Brief', 'Brief creativo o técnico del proyecto', 'project', false, true, 4),
        ('Entregable', 'Entregable del proyecto', 'project', false, true, 5)
      ON CONFLICT (name, applies_to) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('finanzas', 'proyectos', 'read', 'Ver proyectos'),
        ('finanzas', 'proyectos', 'write', 'Crear y editar proyectos'),
        ('finanzas', 'proyectos', 'delete', 'Eliminar proyectos'),
        ('finanzas', 'proyectos.financiero', 'read', 'Ver información financiera del proyecto'),
        ('finanzas', 'proyectos.financiero', 'write', 'Editar información financiera del proyecto')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS projects.project_display_id_seq
        START WITH 1 INCREMENT BY 1 NO MAXVALUE CACHE 1
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pr_client ON projects.project_records(client_record_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pr_brand ON projects.project_records(brand_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pr_pm ON projects.project_records(project_manager_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pr_status ON projects.project_records(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pr_cor ON projects.project_records(cor_project_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pm_project ON projects.project_members(project_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pm_employee ON projects.project_members(employee_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ph_project ON projects.project_history(project_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS projects.project_history`);
    await queryRunner.query(`DROP TABLE IF EXISTS projects.project_documents`);
    await queryRunner.query(`DROP TABLE IF EXISTS projects.project_billing_milestones`);
    await queryRunner.query(`DROP TABLE IF EXISTS projects.project_financials`);
    await queryRunner.query(`DROP TABLE IF EXISTS projects.project_business_units`);
    await queryRunner.query(`DROP TABLE IF EXISTS projects.project_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS projects.project_records`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS projects.project_display_id_seq`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS projects`);
  }
}
