import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHelpDeskModule1719300000000 implements MigrationInterface {
  name = 'CreateHelpDeskModule1719300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS helpdesk`);

    // ------------------------------------------------------------------ //
    // helpdesk.tickets
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      CREATE TABLE helpdesk.tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        display_id VARCHAR(20) NOT NULL UNIQUE,

        requester_id UUID REFERENCES auth.users(id),
        requester_name VARCHAR(200) NOT NULL,
        requester_area VARCHAR(100),
        opened_by_td BOOLEAN DEFAULT false,
        opened_on_behalf_of TEXT,
        behalf_reason TEXT,

        category VARCHAR(50) NOT NULL,
        subcategory VARCHAR(100),
        equipment_id VARCHAR(50),
        description TEXT NOT NULL,
        impact VARCHAR(20) NOT NULL,

        priority VARCHAR(5),
        assigned_to UUID REFERENCES auth.users(id),
        diagnosis TEXT,
        solution TEXT,
        internal_notes TEXT,
        problem_status VARCHAR(30),

        status VARCHAR(30) NOT NULL DEFAULT 'abierto',
        times_reopened INTEGER DEFAULT 0,
        escalated_to UUID REFERENCES auth.users(id),
        escalation_reason TEXT,
        collaborator_confirmation VARCHAR(20) DEFAULT 'pendiente',

        sla_response_met BOOLEAN,
        sla_resolution_met BOOLEAN,
        resolution_hours DECIMAL(8,2),

        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        first_response_at TIMESTAMPTZ,
        resolved_at TIMESTAMPTZ,
        closed_at TIMESTAMPTZ,
        estimated_delivery TIMESTAMPTZ,

        origin VARCHAR(30) DEFAULT 'WEB_COLLABORATOR',
        is_historical BOOLEAN DEFAULT false,

        deleted_at TIMESTAMPTZ,
        deleted_by UUID REFERENCES auth.users(id)
      )
    `);

    await queryRunner.query(`CREATE INDEX ON helpdesk.tickets(status)`);
    await queryRunner.query(`CREATE INDEX ON helpdesk.tickets(priority)`);
    await queryRunner.query(`CREATE INDEX ON helpdesk.tickets(category)`);
    await queryRunner.query(`CREATE INDEX ON helpdesk.tickets(requester_id)`);
    await queryRunner.query(`CREATE INDEX ON helpdesk.tickets(assigned_to)`);
    await queryRunner.query(`CREATE INDEX ON helpdesk.tickets(requested_at)`);

    // ------------------------------------------------------------------ //
    // helpdesk.ticket_history
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      CREATE TABLE helpdesk.ticket_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL REFERENCES helpdesk.tickets(id),
        user_id UUID REFERENCES auth.users(id),
        user_name VARCHAR(200) NOT NULL,
        action VARCHAR(100) NOT NULL,
        old_value TEXT,
        new_value TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ------------------------------------------------------------------ //
    // helpdesk.ticket_attachments
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      CREATE TABLE helpdesk.ticket_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL REFERENCES helpdesk.tickets(id),
        name VARCHAR(255) NOT NULL,
        s3_key VARCHAR(500) NOT NULL,
        file_size INTEGER,
        mime_type VARCHAR(100),
        uploaded_by UUID REFERENCES auth.users(id),
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ------------------------------------------------------------------ //
    // helpdesk.categories
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS helpdesk.categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(50) NOT NULL UNIQUE,
        priority_base VARCHAR(5),
        sla_response_hours INTEGER,
        sla_resolution_hours INTEGER,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0
      )
    `);

    await queryRunner.query(`
      INSERT INTO helpdesk.categories (name, slug, priority_base, sla_response_hours, sla_resolution_hours, sort_order) VALUES
      ('Equipos de cómputo',         'equipos',          'P2', 2, 8,  1),
      ('Conectividad e internet',    'conectividad',     'P1', 1, 4,  2),
      ('Accesos y permisos',         'accesos',          'P3', 4, 24, 3),
      ('Software y aplicaciones',    'software',         'P3', 4, 24, 4),
      ('Correo electrónico',         'correo',           'P3', 4, 24, 5),
      ('Infraestructura / Servidor', 'infraestructura',  'P1', 1, 4,  6),
      ('Seguridad',                  'seguridad',        'P1', 0, 0,  7),
      ('Solicitud nueva / mejora',   'mejora',           'P4', 8, 72, 8)
    `);

    // ------------------------------------------------------------------ //
    // helpdesk.subcategories
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS helpdesk.subcategories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category_slug VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0
      )
    `);

    await queryRunner.query(`
      INSERT INTO helpdesk.subcategories (category_slug, name, sort_order) VALUES
      ('equipos','Equipo lento',1),('equipos','No enciende',2),('equipos','Pantalla/monitor',3),
      ('equipos','BitLocker',4),('equipos','Teclado/mouse',5),('equipos','Webcam',6),
      ('equipos','Batería',7),('equipos','Segunda pantalla',8),('equipos','Otros periféricos',9),
      ('conectividad','Sin internet (WiFi)',1),('conectividad','Sin internet (Ethernet)',2),
      ('conectividad','VPN',3),('conectividad','Red en sala/oficina',4),('conectividad','Caída del ISP',5),
      ('accesos','Alta en Active Directory',1),('accesos','Cambio de contraseña',2),
      ('accesos','Instalar aplicación',3),('accesos','Desbloqueo de cuenta',4),
      ('accesos','MFA',5),('accesos','Permisos en plataforma',6),
      ('software','Microsoft 365',1),('software','Impresoras',2),('software','Antivirus',3),
      ('software','OneDrive/SharePoint',4),('software','Aplicación corporativa',5),
      ('software','Windows',6),('software','Otra app',7),
      ('correo','No envía/recibe',1),('correo','Alias/dominio',2),('correo','Firma corporativa',3),
      ('correo','Buzón lleno',4),('correo','Lista de distribución',5),('correo','Cuenta nueva',6),
      ('infraestructura','Servidor físico',1),('infraestructura','Active Directory',2),
      ('infraestructura','DNS/dominio',3),('infraestructura','Firewall/red',4),
      ('infraestructura','Impresora de red',5),('infraestructura','Almacenamiento',6),
      ('seguridad','Phishing',1),('seguridad','Hackeo de cuenta',2),
      ('seguridad','Acceso no autorizado',3),('seguridad','Pérdida de dispositivo',4),('seguridad','Malware sospechoso',5),
      ('mejora','Nuevo software',1),('mejora','Nueva licencia',2),
      ('mejora','Nueva herramienta SaaS',3),('mejora','Capacitación',4),('mejora','Configuración especial',5)
    `);

    // ------------------------------------------------------------------ //
    // auth.permissions seed
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
      ('transformacion', 'tickets',          'read',  'Ver tickets de soporte'),
      ('transformacion', 'tickets',          'write', 'Crear tickets de soporte'),
      ('transformacion', 'tickets.gestion',  'read',  'Ver todos los tickets (TD)'),
      ('transformacion', 'tickets.gestion',  'write', 'Gestionar tickets (TD)'),
      ('transformacion', 'tickets.reportes', 'read',  'Ver reportes de tickets')
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM auth.permissions WHERE module IN ('tickets', 'tickets.gestion', 'tickets.reportes')`);
    await queryRunner.query(`DROP TABLE IF EXISTS helpdesk.subcategories`);
    await queryRunner.query(`DROP TABLE IF EXISTS helpdesk.categories`);
    await queryRunner.query(`DROP TABLE IF EXISTS helpdesk.ticket_attachments`);
    await queryRunner.query(`DROP TABLE IF EXISTS helpdesk.ticket_history`);
    await queryRunner.query(`DROP TABLE IF EXISTS helpdesk.tickets`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS helpdesk`);
  }
}
