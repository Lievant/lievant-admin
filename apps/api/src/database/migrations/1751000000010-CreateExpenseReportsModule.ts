import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reporte de Gastos por Reembolso (FIN-RE-07).
 *
 * Los catálogos van como dos tablas propias —catalogs.expense_concepts y
 * catalogs.expense_types— y no como filas de un par catalog_types/catalog_items:
 * ese par no existe en este proyecto. El schema `catalogs` usa una tabla por
 * catálogo (areas, divisions, locations…) con la misma forma que
 * CatalogBaseEntity, y crear un motor genérico en paralelo dejaría dos
 * arquitecturas de catálogo compitiendo.
 *
 * `total` de la línea es una columna generada: el subtotal, la propina y los
 * extras se capturan por separado y el total nunca debe poder discrepar de su
 * suma, ni siquiera si alguien inserta por SQL.
 */
export class CreateExpenseReportsModule1751000000010 implements MigrationInterface {
  name = 'CreateExpenseReportsModule1751000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS expenses`);

    // ── Catálogos ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS catalogs.expense_concepts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT true,
        sort_order SMALLINT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS catalogs.expense_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT true,
        sort_order SMALLINT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      INSERT INTO catalogs.expense_concepts (name, sort_order) VALUES
        ('Transporte Terrestre', 1),
        ('Transporte Aéreo', 2),
        ('Alimentación', 3),
        ('Hospedaje', 4),
        ('Otros', 5)
      ON CONFLICT (name) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO catalogs.expense_types (name, sort_order) VALUES
        ('Viáticos cliente', 1),
        ('Costo operativo', 2),
        ('Costo de Marketing', 3),
        ('Costo de venta / temas comerciales', 4)
      ON CONFLICT (name) DO NOTHING
    `);

    // ── Reportes ────────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS expenses.report_number_seq START 1`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS expenses.expense_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Identificación del documento en el SGSI
        document_code VARCHAR(20) DEFAULT 'FIN-RE-07',
        document_version VARCHAR(10) DEFAULT '00',
        document_classification VARCHAR(5) DEFAULT 'C2',

        report_number VARCHAR(20) UNIQUE,

        requester_id UUID NOT NULL REFERENCES auth.users(id),
        requester_employee_id UUID REFERENCES employees.employee_records(id),
        authorizer_id UUID REFERENCES auth.users(id),
        authorizer_employee_id UUID REFERENCES employees.employee_records(id),

        department VARCHAR(100),
        motive TEXT NOT NULL,

        period_start DATE NOT NULL,
        period_end DATE NOT NULL,

        total_subtotal DECIMAL(14,2) DEFAULT 0,
        total_tip DECIMAL(14,2) DEFAULT 0,
        total_extras DECIMAL(14,2) DEFAULT 0,
        total_amount DECIMAL(14,2) DEFAULT 0,

        -- draft | submitted | authorized | rejected | processed
        status VARCHAR(20) DEFAULT 'draft',

        authorized_at TIMESTAMPTZ,
        authorization_note TEXT,

        processed_by UUID REFERENCES auth.users(id),
        processed_at TIMESTAMPTZ,
        payment_date DATE,
        payment_note TEXT,

        submitted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    // Índices nombrados: los que genera `CREATE INDEX ON tabla(col)` reciben un
    // nombre automático que el down() no puede borrar de forma determinista.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_expense_reports_requester ON expenses.expense_reports(requester_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_expense_reports_status ON expenses.expense_reports(status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_expense_reports_period_start ON expenses.expense_reports(period_start)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_expense_reports_authorizer ON expenses.expense_reports(authorizer_id)`,
    );

    // ── Líneas ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS expenses.expense_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID NOT NULL REFERENCES expenses.expense_reports(id) ON DELETE CASCADE,

        line_date DATE NOT NULL,
        vendor VARCHAR(300) NOT NULL,

        concept_id UUID REFERENCES catalogs.expense_concepts(id),
        -- Se guarda el nombre además del id: si mañana renombran el catálogo,
        -- un reporte ya pagado debe seguir mostrando el concepto con el que se
        -- autorizó.
        concept_name VARCHAR(100),

        expense_type_id UUID REFERENCES catalogs.expense_types(id),
        expense_type_name VARCHAR(100),

        subtotal DECIMAL(14,2) DEFAULT 0,
        tip DECIMAL(14,2) DEFAULT 0,
        extras DECIMAL(14,2) DEFAULT 0,
        total DECIMAL(14,2) GENERATED ALWAYS AS (subtotal + tip + extras) STORED,

        has_invoice BOOLEAN DEFAULT false,
        invoice_s3_key VARCHAR(500),
        invoice_original_name VARCHAR(300),

        notes TEXT,
        sort_order INTEGER DEFAULT 0,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_expense_lines_report ON expenses.expense_lines(report_id)`,
    );

    // ── Permisos ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description) VALUES
        ('herramientas', 'reembolsos', 'read', 'Ver mis reportes de reembolso'),
        ('herramientas', 'reembolsos', 'write', 'Crear y editar reportes de reembolso'),
        ('finanzas', 'reembolsos', 'read', 'Ver todos los reportes de reembolso'),
        ('finanzas', 'reembolsos', 'process', 'Procesar y registrar pagos de reembolsos')
      ON CONFLICT (section, module, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM auth.roles r, auth.permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'DIRECTOR', 'COLABORADOR')
        AND p.section = 'herramientas' AND p.module = 'reembolsos'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM auth.roles r, auth.permissions p
      WHERE r.name = 'SUPER_ADMIN'
        AND p.section = 'finanzas' AND p.module = 'reembolsos'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions WHERE module = 'reembolsos'
      )
    `);
    await queryRunner.query(`DELETE FROM auth.permissions WHERE module = 'reembolsos'`);

    await queryRunner.query(`DROP TABLE IF EXISTS expenses.expense_lines`);
    await queryRunner.query(`DROP TABLE IF EXISTS expenses.expense_reports`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS expenses.report_number_seq`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS expenses RESTRICT`);

    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.expense_concepts`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.expense_types`);
  }
}
