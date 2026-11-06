import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RRHH 2.0 · Módulo 8: Solicitud de Puesto de Trabajo.
 *
 * Aditiva e idempotente: crea `hr.job_requisitions` y las filas de permisos
 * `rrhh.solicitudes-puesto.*`, y siembra dos flujos del módulo de notificaciones
 * con sus destinatarios; no toca ninguna tabla existente.
 *
 * - `code` (SOL-001…) único solo entre no eliminados (índice parcial). El
 *   consecutivo lo genera el servidor y no reutiliza códigos eliminados.
 * - Los campos de contenido son nulables: en borrador solo se exige el tipo; todo
 *   se exige al enviar (lo valida el servidor).
 * - Flujo `borrador → enviada → aprobada | rechazada`.
 *
 * Permisos: `read` para SUPER_ADMIN y DIRECTOR; `approve` (aprobar y rechazar)
 * solo para SUPER_ADMIN. A quien deba aprobar se le da por permiso de usuario.
 *
 * Notificaciones (mismo mecanismo que Helpdesk y Vacaciones):
 * - `rrhh.solicitud_puesto_enviada` → destinatario por permiso
 *   `rrhh.solicitudes-puesto.approve` (todos los que puedan aprobar).
 * - `rrhh.solicitud_puesto_resuelta` → el solicitante.
 */
export class CreateJobRequisitions1751000000038 implements MigrationInterface {
  name = 'CreateJobRequisitions1751000000038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS hr`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hr.job_requisitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(20) NOT NULL,
        requester_employee_id UUID NOT NULL REFERENCES employees.employee_records(id),
        requester_user_id UUID NOT NULL REFERENCES auth.users(id),
        type VARCHAR(20) NOT NULL CHECK (type IN ('nueva_posicion','reemplazo','temporal')),
        job_position_id UUID REFERENCES hr.job_positions(id),
        position_title VARCHAR(200),
        area VARCHAR(100) NOT NULL,
        reason TEXT,
        business_justification TEXT,
        required_date DATE,
        modality VARCHAR(20) CHECK (modality IN ('presencial','hibrido','remoto')),
        country VARCHAR(20) CHECK (country IN ('mexico','colombia','eeuu')),
        basic_profile TEXT,
        priority VARCHAR(10) CHECK (priority IN ('alta','media','baja')),
        status VARCHAR(20) NOT NULL DEFAULT 'borrador'
          CHECK (status IN ('borrador','enviada','aprobada','rechazada')),
        submitted_at TIMESTAMPTZ,
        reviewed_by UUID REFERENCES auth.users(id),
        reviewed_at TIMESTAMPTZ,
        review_comments TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_job_requisitions_code ON hr.job_requisitions (code) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_job_requisitions_requester
      ON hr.job_requisitions (requester_employee_id) WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_job_requisitions_status
      ON hr.job_requisitions (status) WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_job_requisitions_submitted
      ON hr.job_requisitions (submitted_at) WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('rrhh', 'solicitudes-puesto', 'read', 'Ver las solicitudes de puesto enviadas por los líderes'),
        ('rrhh', 'solicitudes-puesto', 'approve', 'Aprobar o rechazar solicitudes de puesto')
      ON CONFLICT (section, module, action) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE p.section = 'rrhh' AND p.module = 'solicitudes-puesto'
        AND (
          (r.name IN ('SUPER_ADMIN', 'DIRECTOR') AND p.action = 'read')
          OR (r.name = 'SUPER_ADMIN' AND p.action = 'approve')
        )
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    // Flujos de notificación y sus destinatarios (el panel de flujos puede ajustarlos después).
    await queryRunner.query(`
      INSERT INTO notifications.notification_flows (module, event, name, description) VALUES
        ('rrhh', 'solicitud_puesto_enviada', 'RRHH — Solicitud de puesto enviada',
         'Se dispara cuando un líder envía una solicitud de puesto a RRHH'),
        ('rrhh', 'solicitud_puesto_resuelta', 'RRHH — Solicitud de puesto resuelta',
         'Se dispara cuando RRHH aprueba o rechaza una solicitud de puesto')
      ON CONFLICT (module, event) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO notifications.flow_recipients (flow_id, recipient_type, permission_key, notification_type, sort_order)
      SELECT f.id, 'permiso', 'rrhh.solicitudes-puesto.approve', 'accion', 0
      FROM notifications.notification_flows f
      WHERE f.module = 'rrhh' AND f.event = 'solicitud_puesto_enviada'
        AND NOT EXISTS (SELECT 1 FROM notifications.flow_recipients r WHERE r.flow_id = f.id)
    `);
    await queryRunner.query(`
      INSERT INTO notifications.flow_recipients (flow_id, recipient_type, notification_type, sort_order)
      SELECT f.id, 'solicitante', 'informativa', 0
      FROM notifications.notification_flows f
      WHERE f.module = 'rrhh' AND f.event = 'solicitud_puesto_resuelta'
        AND NOT EXISTS (SELECT 1 FROM notifications.flow_recipients r WHERE r.flow_id = f.id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM notifications.notification_flows
      WHERE module = 'rrhh' AND event IN ('solicitud_puesto_enviada', 'solicitud_puesto_resuelta')
    `);

    await queryRunner.query(`
      DELETE FROM auth.user_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'rrhh' AND module = 'solicitudes-puesto')
    `);
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'rrhh' AND module = 'solicitudes-puesto')
    `);
    await queryRunner.query(`DELETE FROM auth.permissions WHERE section = 'rrhh' AND module = 'solicitudes-puesto'`);

    await queryRunner.query(`DROP INDEX IF EXISTS hr.idx_job_requisitions_submitted`);
    await queryRunner.query(`DROP INDEX IF EXISTS hr.idx_job_requisitions_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS hr.idx_job_requisitions_requester`);
    await queryRunner.query(`DROP INDEX IF EXISTS hr.uq_job_requisitions_code`);
    await queryRunner.query(`DROP TABLE IF EXISTS hr.job_requisitions`);
  }
}
