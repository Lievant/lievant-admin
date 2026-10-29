import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Clientes · Homologación (AG-CLI-001): tablas de staging del agente.
 *
 * Aditiva: crea el schema `homologation` y las filas de permisos
 * `clientes.homologacion.read|write`; no toca ninguna tabla existente.
 *
 * - `*_raw`: snapshots crudos de CONTPAQi, COR y Dynamics, agrupados por
 *   `snapshot_run_id`.
 * - `proposals`: propuestas del agente (HOM-000001) pendientes de decisión humana.
 * - `crosswalk`: equivalencias aprobadas entre sistemas; un id externo pertenece
 *   a un solo cliente maestro (`uq_crosswalk_sistema_externo`, diferible para
 *   permitir fusiones dentro de una transacción).
 * - `runs`: ejecuciones del agente (RUN-000001) con tokens y costo, para auditoría.
 *
 * Permisos: `clientes.homologacion.read|write` solo para SUPER_ADMIN.
 */
export class CreateHomologationTables1751000000045 implements MigrationInterface {
  name = 'CreateHomologationTables1751000000045';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS homologation`);

    // Snapshot crudo de CONTPAQi
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS homologation.contpaqi_clients_raw (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contpaq_id VARCHAR(100) NOT NULL,
        razon_social VARCHAR(300),
        nombre_comercial VARCHAR(300),
        rfc VARCHAR(20),
        segmento VARCHAR(100),
        tipo VARCHAR(100),
        estatus VARCHAR(50),
        condiciones_pago VARCHAR(100),
        limite_credito NUMERIC(14,2),
        raw_data JSONB,
        snapshot_at TIMESTAMPTZ DEFAULT NOW(),
        snapshot_run_id UUID
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_contpaqi_raw_contpaq_id ON homologation.contpaqi_clients_raw (contpaq_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_contpaqi_raw_rfc ON homologation.contpaqi_clients_raw (rfc)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_contpaqi_raw_run ON homologation.contpaqi_clients_raw (snapshot_run_id)`,
    );

    // Snapshot crudo de COR
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS homologation.cor_clients_raw (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cor_id VARCHAR(100) NOT NULL,
        nombre VARCHAR(300),
        contacto VARCHAR(200),
        email VARCHAR(200),
        raw_data JSONB,
        snapshot_at TIMESTAMPTZ DEFAULT NOW(),
        snapshot_run_id UUID
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_cor_raw_cor_id ON homologation.cor_clients_raw (cor_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_cor_raw_run ON homologation.cor_clients_raw (snapshot_run_id)`,
    );

    // Snapshot crudo de Dynamics
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS homologation.dynamics_accounts_raw (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dynamics_id VARCHAR(100) NOT NULL,
        name VARCHAR(300),
        account_number VARCHAR(100),
        rfc VARCHAR(20),
        website VARCHAR(500),
        raw_data JSONB,
        snapshot_at TIMESTAMPTZ DEFAULT NOW(),
        snapshot_run_id UUID
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_dynamics_raw_dynamics_id ON homologation.dynamics_accounts_raw (dynamics_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_dynamics_raw_run ON homologation.dynamics_accounts_raw (snapshot_run_id)`,
    );

    // Propuestas del agente (pendientes de aprobación humana)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS homologation.proposals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        proposal_code VARCHAR(20) UNIQUE NOT NULL,
        run_id UUID NOT NULL,
        tipo VARCHAR(30) NOT NULL
          CHECK (tipo IN ('vincular','nuevo_maestro','fusionar','separar','escalar')),
        client_record_id UUID REFERENCES clients.client_records(id),
        sistemas_involucrados JSONB NOT NULL,
        confianza NUMERIC(4,3) CHECK (confianza BETWEEN 0 AND 1),
        evidencia_a_favor JSONB,
        evidencia_en_contra JSONB,
        explicacion TEXT NOT NULL,
        agente_version VARCHAR(20),
        status VARCHAR(20) NOT NULL DEFAULT 'pendiente'
          CHECK (status IN ('pendiente','aprobada','rechazada','escalada')),
        decided_by UUID REFERENCES auth.users(id),
        decided_at TIMESTAMPTZ,
        decision_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS homologation.proposal_number_seq START 1`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_proposals_status ON homologation.proposals (status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_proposals_run ON homologation.proposals (run_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_proposals_client ON homologation.proposals (client_record_id)`,
    );

    // Crosswalk aprobado (equivalencias entre sistemas). La restricción única ya
    // indexa (sistema, id_externo).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS homologation.crosswalk (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_record_id UUID NOT NULL REFERENCES clients.client_records(id),
        sistema VARCHAR(30) NOT NULL
          CHECK (sistema IN ('contpaqi','cor','dynamics','admin','alegra')),
        id_externo VARCHAR(200) NOT NULL,
        nombre_externo VARCHAR(300),
        metodo VARCHAR(20) NOT NULL
          CHECK (metodo IN ('regla','agente','manual')),
        confianza NUMERIC(4,3),
        estado VARCHAR(20) NOT NULL DEFAULT 'activo'
          CHECK (estado IN ('activo','revocado')),
        proposal_id UUID REFERENCES homologation.proposals(id),
        approved_by UUID REFERENCES auth.users(id),
        approved_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        revoked_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_crosswalk_sistema_externo UNIQUE (sistema, id_externo)
          DEFERRABLE INITIALLY DEFERRED
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_crosswalk_client ON homologation.crosswalk (client_record_id)`,
    );

    // Ejecuciones del agente (auditoría)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS homologation.runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_code VARCHAR(20) UNIQUE NOT NULL,
        disparador VARCHAR(50) NOT NULL,
        agente_version VARCHAR(20),
        modelo_version VARCHAR(100),
        status VARCHAR(20) NOT NULL DEFAULT 'en_progreso'
          CHECK (status IN ('en_progreso','completado','fallido','cancelado')),
        candidatos_total INTEGER DEFAULT 0,
        propuestas_vincular INTEGER DEFAULT 0,
        propuestas_nuevo_maestro INTEGER DEFAULT 0,
        propuestas_escalar INTEGER DEFAULT 0,
        tokens_entrada INTEGER,
        tokens_salida INTEGER,
        costo_usd NUMERIC(10,6),
        alertas JSONB,
        error_message TEXT,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS homologation.run_number_seq START 1`);

    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('clientes', 'homologacion', 'read', 'Ver propuestas de homologación de clientes'),
        ('clientes', 'homologacion', 'write', 'Aprobar o rechazar propuestas de homologación')
      ON CONFLICT (section, module, action) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name = 'SUPER_ADMIN'
        AND p.section = 'clientes' AND p.module = 'homologacion'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.user_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'clientes' AND module = 'homologacion')
    `);
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'clientes' AND module = 'homologacion')
    `);
    await queryRunner.query(
      `DELETE FROM auth.permissions WHERE section = 'clientes' AND module = 'homologacion'`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS homologation.crosswalk`);
    await queryRunner.query(`DROP TABLE IF EXISTS homologation.proposals`);
    await queryRunner.query(`DROP TABLE IF EXISTS homologation.runs`);
    await queryRunner.query(`DROP TABLE IF EXISTS homologation.dynamics_accounts_raw`);
    await queryRunner.query(`DROP TABLE IF EXISTS homologation.cor_clients_raw`);
    await queryRunner.query(`DROP TABLE IF EXISTS homologation.contpaqi_clients_raw`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS homologation.run_number_seq`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS homologation.proposal_number_seq`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS homologation`);
  }
}
