import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Matriz de Riesgos a la Seguridad de la Información (TIC-RE-08).
 *
 * `risk_value` y `residual_risk` se persisten aunque son derivados: la tabla del
 * panel ordena por ellos y la fórmula la aplica siempre el backend al guardar
 * (valor = vulnerabilidad × severidad × probabilidad; residual = valor ×
 * eficacia, a 2 decimales). Los CHECK acotan los rangos por si alguien escribe
 * por SQL.
 *
 * Borrado lógico por `deleted_at`. Los permisos `sgsi.riesgos.read|write` se
 * asignan solo a SUPER_ADMIN, igual que `sgsi.isobot.write` en la 013.
 *
 * Idempotente (IF NOT EXISTS / ON CONFLICT / NOT EXISTS) para poder reintentarla
 * si quedó a medias en un entorno.
 */
export class CreateRiskMatrix1751000000033 implements MigrationInterface {
  name = 'CreateRiskMatrix1751000000033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS sgsi`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sgsi.risks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category VARCHAR(100) NOT NULL,
        threat VARCHAR(300) NOT NULL,
        vulnerability VARCHAR(300) NOT NULL,
        affected_asset VARCHAR(200) NOT NULL,
        risk TEXT NOT NULL,
        vulnerability_score SMALLINT NOT NULL
          CONSTRAINT chk_risks_vulnerability_score CHECK (vulnerability_score BETWEEN 1 AND 5),
        severity_score SMALLINT NOT NULL
          CONSTRAINT chk_risks_severity_score CHECK (severity_score BETWEEN 1 AND 5),
        probability_score SMALLINT NOT NULL
          CONSTRAINT chk_risks_probability_score CHECK (probability_score BETWEEN 1 AND 5),
        risk_value SMALLINT NOT NULL
          CONSTRAINT chk_risks_risk_value CHECK (risk_value BETWEEN 1 AND 125),
        control TEXT NOT NULL,
        control_efficacy NUMERIC(2,1) NOT NULL
          CONSTRAINT chk_risks_control_efficacy CHECK (control_efficacy IN (0.1, 0.2, 0.3, 0.4, 0.5)),
        residual_risk NUMERIC(5,2) NOT NULL
          CONSTRAINT chk_risks_residual_risk CHECK (residual_risk BETWEEN 0.1 AND 62.5),
        reported_at DATE,
        mitigation_strategy TEXT,
        actions TEXT,
        estimated_resolution_date DATE,
        owner VARCHAR(200) NOT NULL,
        action_status VARCHAR(20) NOT NULL DEFAULT 'No iniciado'
          CONSTRAINT chk_risks_action_status CHECK (
            action_status IN ('No iniciado', 'Pendiente', 'Iniciado', 'En proceso', 'Resuelto')
          ),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        deleted_at TIMESTAMPTZ,
        deleted_by UUID
      )
    `);

    // La pantalla lista solo los activos, del más reciente al más viejo.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_risks_active_updated
        ON sgsi.risks(updated_at DESC) WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('sgsi', 'riesgos', 'read', 'Ver la Matriz de Riesgos a la Seguridad de la Información (TIC-RE-08)'),
        ('sgsi', 'riesgos', 'write', 'Crear, editar y eliminar riesgos de la Matriz de Riesgos (TIC-RE-08)')
      ON CONFLICT (section, module, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM auth.roles r, auth.permissions p
      WHERE r.name = 'SUPER_ADMIN'
        AND p.section = 'sgsi' AND p.module = 'riesgos' AND p.action IN ('read', 'write')
        AND NOT EXISTS (
          SELECT 1 FROM auth.role_permissions rp
          WHERE rp.role_id = r.id AND rp.permission_id = p.id
        )
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.user_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions WHERE section = 'sgsi' AND module = 'riesgos'
      )
    `);
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions WHERE section = 'sgsi' AND module = 'riesgos'
      )
    `);
    await queryRunner.query(`
      DELETE FROM auth.permissions WHERE section = 'sgsi' AND module = 'riesgos'
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS sgsi.idx_risks_active_updated`);
    await queryRunner.query(`DROP TABLE IF EXISTS sgsi.risks`);
    // Sin CASCADE: si el schema tuviera otras tablas, se conserva.
    await queryRunner.query(`DROP SCHEMA IF EXISTS sgsi`);
  }
}
