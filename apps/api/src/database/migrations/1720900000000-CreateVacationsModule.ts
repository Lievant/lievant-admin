import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVacationsModule1720900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS hr`);

    // -----------------------------------------------------------------------
    // 1. Campo días laborales en empleados
    //    1=Lunes … 7=Domingo. Default: lunes a viernes.
    // -----------------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE employees.employee_records
        ADD COLUMN IF NOT EXISTS work_days INTEGER[] DEFAULT '{1,2,3,4,5}'
    `);

    // -----------------------------------------------------------------------
    // 2. Festivos (catálogo configurable)
    // -----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS catalogs.holidays (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        date DATE NOT NULL,
        is_recurring BOOLEAN DEFAULT true,
        country VARCHAR(3) DEFAULT 'MEX',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      INSERT INTO catalogs.holidays (name, date, is_recurring, country) VALUES
      ('Año Nuevo', '2024-01-01', true, 'MEX'),
      ('Día de la Constitución', '2024-02-05', true, 'MEX'),
      ('Natalicio de Benito Juárez', '2024-03-21', true, 'MEX'),
      ('Día del Trabajo', '2024-05-01', true, 'MEX'),
      ('Independencia de México', '2024-09-16', true, 'MEX'),
      ('Revolución Mexicana', '2024-11-20', true, 'MEX'),
      ('Transmisión del Poder Ejecutivo', '2024-10-01', false, 'MEX'),
      ('Navidad', '2024-12-25', true, 'MEX'),
      ('Jueves Santo', '2024-03-28', false, 'MEX'),
      ('Viernes Santo', '2024-03-29', false, 'MEX')
      ON CONFLICT DO NOTHING
    `);

    // -----------------------------------------------------------------------
    // 3. Política de vacaciones (tabla de antigüedad → días) — LFT 2023
    // -----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hr.vacation_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        country VARCHAR(3) DEFAULT 'MEX',
        year_from INTEGER NOT NULL,
        year_to INTEGER,
        vacation_days INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT true
      )
    `);

    await queryRunner.query(`
      INSERT INTO hr.vacation_policies (country, year_from, year_to, vacation_days) VALUES
      ('MEX', 1, 1, 12),
      ('MEX', 2, 2, 14),
      ('MEX', 3, 3, 16),
      ('MEX', 4, 4, 18),
      ('MEX', 5, 5, 20),
      ('MEX', 6, 10, 22),
      ('MEX', 11, 15, 24),
      ('MEX', 16, 20, 26),
      ('MEX', 21, 25, 28),
      ('MEX', 26, 30, 30)
      ON CONFLICT DO NOTHING
    `);

    // -----------------------------------------------------------------------
    // 4. Saldos de vacaciones por período
    // -----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hr.vacation_balances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES employees.employee_records(id),
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        years_of_service INTEGER NOT NULL,
        entitled_days INTEGER NOT NULL,
        used_days DECIMAL(6,2) DEFAULT 0,
        expired_days DECIMAL(6,2) DEFAULT 0,
        is_current BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(employee_id, period_start)
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_vacation_balances_employee ON hr.vacation_balances(employee_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_vacation_balances_period_end ON hr.vacation_balances(period_end)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_vacation_balances_is_current ON hr.vacation_balances(is_current)`);

    // -----------------------------------------------------------------------
    // 5. Solicitudes de vacaciones
    // -----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hr.vacation_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        display_id VARCHAR(20) NOT NULL UNIQUE,
        employee_id UUID NOT NULL REFERENCES employees.employee_records(id),
        balance_id UUID NOT NULL REFERENCES hr.vacation_balances(id),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        working_days_taken DECIMAL(6,2) NOT NULL,
        substitute_employee_id UUID REFERENCES employees.employee_records(id),
        status VARCHAR(20) DEFAULT 'pending',
        approved_by UUID REFERENCES employees.employee_records(id),
        approved_at TIMESTAMPTZ,
        rejection_reason TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS hr.vacation_request_seq START WITH 1 INCREMENT BY 1`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_vacation_requests_employee ON hr.vacation_requests(employee_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_vacation_requests_status ON hr.vacation_requests(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_vacation_requests_dates ON hr.vacation_requests(start_date, end_date)`);

    // -----------------------------------------------------------------------
    // 6. Historial de movimientos
    // -----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hr.vacation_movements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES employees.employee_records(id),
        balance_id UUID REFERENCES hr.vacation_balances(id),
        request_id UUID REFERENCES hr.vacation_requests(id),
        movement_type VARCHAR(30) NOT NULL,
        days_delta DECIMAL(6,2) NOT NULL,
        description TEXT,
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_vacation_movements_employee ON hr.vacation_movements(employee_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_vacation_movements_balance ON hr.vacation_movements(balance_id)`);

    // -----------------------------------------------------------------------
    // 7. Permisos
    // -----------------------------------------------------------------------
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('herramientas', 'vacaciones', 'read', 'Ver mis vacaciones'),
        ('herramientas', 'vacaciones', 'write', 'Solicitar vacaciones'),
        ('rrhh', 'empleados.vacaciones', 'read', 'Ver vacaciones de empleados'),
        ('rrhh', 'empleados.vacaciones', 'write', 'Gestionar vacaciones de empleados'),
        ('rrhh', 'reportes.vacaciones', 'read', 'Ver reporte de vacaciones para nómina')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM auth.roles r, auth.permissions p
      WHERE r.name = 'SUPER_ADMIN'
      AND p.module IN ('vacaciones','empleados.vacaciones','reportes.vacaciones')
      AND p.id NOT IN (
        SELECT permission_id FROM auth.role_permissions rp
        JOIN auth.roles ro ON ro.id = rp.role_id
        WHERE ro.name = 'SUPER_ADMIN'
      )
      ON CONFLICT DO NOTHING
    `);

    // COLABORADOR y DIRECTOR: herramientas.vacaciones (read y write)
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM auth.roles r, auth.permissions p
      WHERE r.name IN ('COLABORADOR', 'DIRECTOR')
      AND p.section = 'herramientas' AND p.module = 'vacaciones'
      AND p.id NOT IN (
        SELECT permission_id FROM auth.role_permissions rp
        JOIN auth.roles ro ON ro.id = rp.role_id
        WHERE ro.name = r.name
      )
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Permisos (borra también los role_permissions vía FK cascade lógica manual)
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions
        WHERE module IN ('vacaciones','empleados.vacaciones','reportes.vacaciones')
      )
    `);
    await queryRunner.query(`
      DELETE FROM auth.permissions
      WHERE module IN ('vacaciones','empleados.vacaciones','reportes.vacaciones')
    `);

    // Tablas (orden inverso por FKs)
    await queryRunner.query(`DROP TABLE IF EXISTS hr.vacation_movements`);
    await queryRunner.query(`DROP TABLE IF EXISTS hr.vacation_requests`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS hr.vacation_request_seq`);
    await queryRunner.query(`DROP TABLE IF EXISTS hr.vacation_balances`);
    await queryRunner.query(`DROP TABLE IF EXISTS hr.vacation_policies`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.holidays`);

    await queryRunner.query(`ALTER TABLE employees.employee_records DROP COLUMN IF EXISTS work_days`);
  }
}
