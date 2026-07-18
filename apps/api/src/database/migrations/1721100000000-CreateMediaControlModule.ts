import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMediaControlModule1721100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS media_control`);

    // Catálogo de plataformas publicitarias
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS media_control.platforms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(50) NOT NULL UNIQUE,
        icon VARCHAR(50),
        color VARCHAR(20),
        phase INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        data_latency_hours INTEGER DEFAULT 1,
        supports_pause BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      INSERT INTO media_control.platforms (name, slug, icon, color, phase, data_latency_hours, supports_pause) VALUES
      ('Meta Ads', 'meta', 'ti-brand-facebook', '#1877F2', 1, 1, true),
      ('Google Ads', 'google', 'ti-brand-google', '#4285F4', 1, 1, true),
      ('X Ads', 'x', 'ti-brand-x', '#000000', 1, 1, true),
      ('Mercado Ads', 'mercado', 'ti-brand-mercado-pago', '#FFE600', 2, 24, true),
      ('Amazon Ads', 'amazon', 'ti-brand-amazon', '#FF9900', 2, 12, true),
      ('TikTok Ads', 'tiktok', 'ti-brand-tiktok', '#000000', 3, 1, true),
      ('LinkedIn Ads', 'linkedin', 'ti-brand-linkedin', '#0A66C2', 3, 24, true),
      ('Pinterest Ads', 'pinterest', 'ti-brand-pinterest', '#E60023', 3, 24, true)
      ON CONFLICT (slug) DO NOTHING
    `);

    // Credenciales de API (solo referencia a Secrets Manager, nunca el token)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS media_control.api_credentials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform_id UUID NOT NULL REFERENCES media_control.platforms(id),
        name VARCHAR(200) NOT NULL,
        secret_arn VARCHAR(500) NOT NULL,
        credential_type VARCHAR(50) NOT NULL,
        mcc_account_id VARCHAR(100),
        business_account_id VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        last_verified_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES auth.users(id)
      )
    `);

    // Cuentas publicitarias
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS media_control.ad_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform_id UUID NOT NULL REFERENCES media_control.platforms(id),
        credential_id UUID REFERENCES media_control.api_credentials(id),
        client_record_id UUID REFERENCES clients.client_records(id),
        native_account_id VARCHAR(200) NOT NULL,
        native_account_name VARCHAR(300),
        currency VARCHAR(3) DEFAULT 'MXN',
        timezone VARCHAR(100) DEFAULT 'America/Mexico_City',
        is_active BOOLEAN DEFAULT true,
        sync_enabled BOOLEAN DEFAULT true,
        account_manager_id UUID REFERENCES employees.employee_records(id),
        last_synced_at TIMESTAMPTZ,
        last_sync_error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(platform_id, native_account_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ad_accounts_platform ON media_control.ad_accounts(platform_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ad_accounts_client ON media_control.ad_accounts(client_record_id)`);

    // Gasto diario por cuenta
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS media_control.daily_spend (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ad_account_id UUID NOT NULL REFERENCES media_control.ad_accounts(id),
        spend_date DATE NOT NULL,
        spend_native DECIMAL(14,4) NOT NULL DEFAULT 0,
        currency VARCHAR(3) NOT NULL,
        exchange_rate DECIMAL(10,6) DEFAULT 1,
        spend_mxn DECIMAL(14,4),
        data_source VARCHAR(50) DEFAULT 'api',
        api_response_id VARCHAR(200),
        recorded_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(ad_account_id, spend_date)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_daily_spend_account ON media_control.daily_spend(ad_account_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_daily_spend_date ON media_control.daily_spend(spend_date)`);

    // Presupuestos mensuales (con versiones)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS media_control.budgets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ad_account_id UUID NOT NULL REFERENCES media_control.ad_accounts(id),
        budget_month DATE NOT NULL,
        amount DECIMAL(14,2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'MXN',
        amount_mxn DECIMAL(14,2),
        version INTEGER DEFAULT 1,
        is_current BOOLEAN DEFAULT true,
        approved_by UUID REFERENCES employees.employee_records(id),
        notes TEXT,
        source VARCHAR(20) DEFAULT 'manual',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES auth.users(id)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_budgets_account ON media_control.budgets(ad_account_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_budgets_month ON media_control.budgets(budget_month)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_account_month_version ON media_control.budgets(ad_account_id, budget_month, version)`);

    // Pacing calculado (tabla de hechos, calculada por job)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS media_control.pacing_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ad_account_id UUID NOT NULL REFERENCES media_control.ad_accounts(id),
        budget_id UUID REFERENCES media_control.budgets(id),
        snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
        budget_amount DECIMAL(14,2),
        currency VARCHAR(3),
        spend_accumulated DECIMAL(14,2) DEFAULT 0,
        spend_expected DECIMAL(14,2),
        spend_daily_avg DECIMAL(14,2),
        spend_daily_ideal DECIMAL(14,2),
        spend_daily_remaining DECIMAL(14,2),
        pct_consumed DECIMAL(6,2),
        pacing_pct DECIMAL(6,2),
        projected_close DECIMAL(14,2),
        projected_exhaustion_date DATE,
        days_remaining INTEGER,
        status VARCHAR(10) DEFAULT 'gray',
        calculated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(ad_account_id, snapshot_date)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pacing_snapshots_account ON media_control.pacing_snapshots(ad_account_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pacing_snapshots_date ON media_control.pacing_snapshots(snapshot_date)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pacing_snapshots_status ON media_control.pacing_snapshots(status)`);

    // Alertas
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS media_control.alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ad_account_id UUID NOT NULL REFERENCES media_control.ad_accounts(id),
        alert_type VARCHAR(50) NOT NULL,
        severity VARCHAR(10) NOT NULL,
        message TEXT NOT NULL,
        details JSONB,
        status VARCHAR(20) DEFAULT 'active',
        acknowledged_by UUID REFERENCES auth.users(id),
        acknowledged_at TIMESTAMPTZ,
        resolved_at TIMESTAMPTZ,
        notified_at TIMESTAMPTZ,
        notification_channels JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_alerts_account ON media_control.alerts(ad_account_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_alerts_status ON media_control.alerts(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_alerts_type ON media_control.alerts(alert_type)`);

    // Bitácora de acciones (pausas, ajustes, etc.)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS media_control.audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ad_account_id UUID REFERENCES media_control.ad_accounts(id),
        action_type VARCHAR(50) NOT NULL,
        performed_by UUID REFERENCES auth.users(id),
        reason TEXT,
        before_state JSONB,
        after_state JSONB,
        native_campaign_id VARCHAR(200),
        native_campaign_name VARCHAR(300),
        api_response JSONB,
        success BOOLEAN,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_account ON media_control.audit_log(ad_account_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_action ON media_control.audit_log(action_type)`);

    // Logs técnicos de sincronización
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS media_control.sync_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform_id UUID REFERENCES media_control.platforms(id),
        ad_account_id UUID REFERENCES media_control.ad_accounts(id),
        sync_type VARCHAR(50) NOT NULL,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        status VARCHAR(20) DEFAULT 'running',
        records_fetched INTEGER DEFAULT 0,
        records_saved INTEGER DEFAULT 0,
        error_message TEXT,
        http_status INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Permisos
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('medios', 'dashboard', 'read', 'Ver dashboard ejecutivo de medios'),
        ('medios', 'cuentas', 'read', 'Ver cuentas publicitarias'),
        ('medios', 'cuentas', 'write', 'Gestionar cuentas publicitarias'),
        ('medios', 'presupuestos', 'read', 'Ver presupuestos'),
        ('medios', 'presupuestos', 'write', 'Cargar y editar presupuestos'),
        ('medios', 'presupuestos', 'approve', 'Aprobar ajustes de presupuesto'),
        ('medios', 'campanas', 'pause', 'Pausar campañas vía API'),
        ('medios', 'alertas', 'read', 'Ver alertas de medios'),
        ('medios', 'configuracion', 'write', 'Gestionar tokens y configuración'),
        ('medios', 'auditoria', 'read', 'Ver bitácora de acciones')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM auth.roles r, auth.permissions p
      WHERE r.name = 'SUPER_ADMIN'
      AND p.section = 'medios'
      AND p.id NOT IN (
        SELECT permission_id FROM auth.role_permissions rp
        JOIN auth.roles ro ON ro.id = rp.role_id
        WHERE ro.name = 'SUPER_ADMIN'
      )
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.role_permissions WHERE permission_id IN (
        SELECT id FROM auth.permissions WHERE section = 'medios'
      )
    `);
    await queryRunner.query(`DELETE FROM auth.permissions WHERE section = 'medios'`);

    await queryRunner.query(`DROP TABLE IF EXISTS media_control.sync_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS media_control.audit_log`);
    await queryRunner.query(`DROP TABLE IF EXISTS media_control.alerts`);
    await queryRunner.query(`DROP TABLE IF EXISTS media_control.pacing_snapshots`);
    await queryRunner.query(`DROP TABLE IF EXISTS media_control.budgets`);
    await queryRunner.query(`DROP TABLE IF EXISTS media_control.daily_spend`);
    await queryRunner.query(`DROP TABLE IF EXISTS media_control.ad_accounts`);
    await queryRunner.query(`DROP TABLE IF EXISTS media_control.api_credentials`);
    await queryRunner.query(`DROP TABLE IF EXISTS media_control.platforms`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS media_control CASCADE`);
  }
}
