import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reporte de Gastos de Tarjeta de Crédito (FIN-RE-06).
 *
 * Vive en el schema `expenses` junto a los reembolsos: comparte los catálogos
 * de concepto y tipo de gasto, y separarlo en un schema propio obligaría a
 * cruzar schemas en cada FK sin ganar aislamiento real.
 *
 * A diferencia del reembolso no hay paso de autorización: el gasto ya se hizo
 * con dinero de la empresa, así que el flujo es capturar → enviar a Finanzas →
 * procesar. Por eso `status` solo tiene tres estados y no hay authorizer.
 *
 * `collaborator` es texto libre y no una FK a empleados: quien usó la tarjeta
 * puede ser un invitado, un candidato o alguien que ya no está en plantilla.
 */
export class CreateCreditCardReportsModule1751000000011 implements MigrationInterface {
  name = 'CreateCreditCardReportsModule1751000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Maestro de tarjetas ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS expenses.credit_cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        last_four VARCHAR(4) NOT NULL,
        alias VARCHAR(100),
        holder_employee_id UUID NOT NULL REFERENCES employees.employee_records(id),
        holder_user_id UUID REFERENCES auth.users(id),
        is_active BOOLEAN DEFAULT true,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_credit_cards_holder ON expenses.credit_cards(holder_employee_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_credit_cards_active ON expenses.credit_cards(is_active)`,
    );

    // ── Reportes ────────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS expenses.card_report_number_seq START 1`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS expenses.card_expense_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        document_code VARCHAR(20) DEFAULT 'FIN-RE-06',
        document_version VARCHAR(10) DEFAULT '00',
        document_classification VARCHAR(5) DEFAULT 'C2',
        report_number VARCHAR(20) UNIQUE,

        credit_card_id UUID NOT NULL REFERENCES expenses.credit_cards(id),

        -- El creador puede no ser el titular: un asistente captura los gastos
        -- de la tarjeta de su director.
        creator_id UUID NOT NULL REFERENCES auth.users(id),
        creator_employee_id UUID REFERENCES employees.employee_records(id),

        department VARCHAR(100),
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        observations TEXT,

        total_subtotal DECIMAL(14,2) DEFAULT 0,
        total_tip DECIMAL(14,2) DEFAULT 0,
        total_extras DECIMAL(14,2) DEFAULT 0,
        total_amount DECIMAL(14,2) DEFAULT 0,

        -- draft | submitted | processed
        status VARCHAR(20) DEFAULT 'draft',

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

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_card_reports_card ON expenses.card_expense_reports(credit_card_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_card_reports_creator ON expenses.card_expense_reports(creator_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_card_reports_status ON expenses.card_expense_reports(status)`,
    );

    // ── Líneas ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS expenses.card_expense_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID NOT NULL REFERENCES expenses.card_expense_reports(id) ON DELETE CASCADE,

        line_date DATE NOT NULL,
        collaborator VARCHAR(200),
        motive TEXT,
        vendor VARCHAR(300) NOT NULL,

        concept_id UUID REFERENCES catalogs.expense_concepts(id),
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

        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_card_lines_report ON expenses.card_expense_lines(report_id)`,
    );

    // ── Permisos ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description) VALUES
        ('herramientas', 'gastos-tarjeta', 'read', 'Ver mis reportes de gastos de tarjeta'),
        ('herramientas', 'gastos-tarjeta', 'write', 'Crear reportes de gastos de tarjeta'),
        ('finanzas', 'tarjetas', 'read', 'Ver maestro de tarjetas de crédito'),
        ('finanzas', 'tarjetas', 'write', 'Gestionar tarjetas de crédito'),
        ('finanzas', 'gastos-tarjeta', 'read', 'Ver todos los reportes de gastos de tarjeta'),
        ('finanzas', 'gastos-tarjeta', 'process', 'Procesar reportes de gastos de tarjeta')
      ON CONFLICT (section, module, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM auth.roles r, auth.permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'DIRECTOR', 'COLABORADOR')
        AND p.section = 'herramientas' AND p.module = 'gastos-tarjeta'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM auth.roles r, auth.permissions p
      WHERE r.name = 'SUPER_ADMIN'
        AND p.section = 'finanzas' AND p.module IN ('tarjetas', 'gastos-tarjeta')
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    // ── Flujos de notificación ──────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO notifications.notification_flows (module, event, name, description) VALUES
        ('gastos-tarjeta', 'reporte_enviado', 'Tarjeta — Reporte enviado',
         'Se dispara cuando se envía un reporte de gastos de tarjeta a Finanzas'),
        ('gastos-tarjeta', 'reporte_procesado', 'Tarjeta — Reporte procesado',
         'Se dispara cuando Finanzas procesa un reporte de tarjeta')
      ON CONFLICT (module, event) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM notifications.notification_flows WHERE module = 'gastos-tarjeta'`,
    );

    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions
        WHERE module IN ('gastos-tarjeta', 'tarjetas')
      )
    `);
    await queryRunner.query(
      `DELETE FROM auth.permissions WHERE module IN ('gastos-tarjeta', 'tarjetas')`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS expenses.card_expense_lines`);
    await queryRunner.query(`DROP TABLE IF EXISTS expenses.card_expense_reports`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS expenses.card_report_number_seq`);
    await queryRunner.query(`DROP TABLE IF EXISTS expenses.credit_cards`);
  }
}
