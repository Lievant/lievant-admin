import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRoomsSchema1718700000000 implements MigrationInterface {
  name = 'CreateRoomsSchema1718700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS rooms`);

    await queryRunner.query(`
      CREATE TABLE rooms.countries (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100) NOT NULL,
        code        VARCHAR(3) NOT NULL UNIQUE,
        is_active   BOOLEAN NOT NULL DEFAULT true,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE rooms.cities (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        country_id  UUID NOT NULL REFERENCES rooms.countries(id),
        name        VARCHAR(100) NOT NULL,
        timezone    VARCHAR(50) NOT NULL DEFAULT 'America/Mexico_City',
        is_active   BOOLEAN NOT NULL DEFAULT true,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE rooms.offices (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        city_id     UUID NOT NULL REFERENCES rooms.cities(id),
        name        VARCHAR(150) NOT NULL,
        address     TEXT,
        is_active   BOOLEAN NOT NULL DEFAULT true,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE rooms.rooms (
        id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        office_id                     UUID NOT NULL REFERENCES rooms.offices(id),
        name                          VARCHAR(150) NOT NULL,
        type                          VARCHAR(20) NOT NULL DEFAULT 'sala_reunion'
                                        CHECK (type IN ('sala_reunion', 'phone_booth')),
        capacity                      INTEGER NOT NULL DEFAULT 1,
        floor                         VARCHAR(50),
        amenities                     JSONB NOT NULL DEFAULT '[]',
        open_time                     TIME NOT NULL DEFAULT '08:00',
        close_time                    TIME NOT NULL DEFAULT '20:00',
        max_booking_hours             INTEGER NOT NULL DEFAULT 4,
        requires_approval_over_hours  INTEGER NOT NULL DEFAULT 4,
        is_active                     BOOLEAN NOT NULL DEFAULT true,
        notes                         TEXT,
        created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by                    UUID NOT NULL,
        updated_by                    UUID NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE rooms.bookings (
        id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id              UUID NOT NULL REFERENCES rooms.rooms(id),
        user_id              UUID NOT NULL REFERENCES auth.users(id),
        title                VARCHAR(255) NOT NULL,
        start_time           TIMESTAMPTZ NOT NULL,
        end_time             TIMESTAMPTZ NOT NULL,
        status               VARCHAR(30) NOT NULL DEFAULT 'confirmada'
                               CHECK (status IN ('confirmada', 'cancelada', 'pendiente_aprobacion')),
        is_recurring         BOOLEAN NOT NULL DEFAULT false,
        recurrence_rule      TEXT,
        recurrence_end_date  DATE,
        recurrence_group_id  UUID,
        ms_event_id          VARCHAR(500),
        notes                TEXT,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        cancelled_at         TIMESTAMPTZ,
        cancelled_by         UUID REFERENCES auth.users(id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE rooms.office_admins (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES auth.users(id),
        office_id   UUID REFERENCES rooms.offices(id),
        scope       VARCHAR(10) NOT NULL DEFAULT 'office'
                      CHECK (scope IN ('global', 'office')),
        granted_by  UUID NOT NULL REFERENCES auth.users(id),
        granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, office_id)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_rooms_bookings_room_time ON rooms.bookings(room_id, start_time, end_time)`,
    );
    await queryRunner.query(`CREATE INDEX idx_rooms_bookings_user_time ON rooms.bookings(user_id, start_time)`);
    await queryRunner.query(`
      CREATE INDEX idx_rooms_bookings_recurrence_group_id ON rooms.bookings(recurrence_group_id)
        WHERE recurrence_group_id IS NOT NULL
    `);
    await queryRunner.query(`CREATE INDEX idx_rooms_bookings_status ON rooms.bookings(status)`);
    await queryRunner.query(`CREATE INDEX idx_rooms_rooms_office_id_is_active ON rooms.rooms(office_id, is_active)`);
    await queryRunner.query(`CREATE INDEX idx_rooms_office_admins_user_id ON rooms.office_admins(user_id)`);

    // Seed: countries
    await queryRunner.query(`
      INSERT INTO rooms.countries (name, code, sort_order) VALUES
        ('México', 'MX', 1),
        ('Colombia', 'CO', 2),
        ('Estados Unidos', 'US', 3)
    `);

    // Seed: cities
    await queryRunner.query(`
      INSERT INTO rooms.cities (country_id, name, timezone, sort_order)
      SELECT id, 'León', 'America/Mexico_City', 1 FROM rooms.countries WHERE code = 'MX'
      UNION ALL
      SELECT id, 'Ciudad de México', 'America/Mexico_City', 2 FROM rooms.countries WHERE code = 'MX'
      UNION ALL
      SELECT id, 'Guadalajara', 'America/Mexico_City', 3 FROM rooms.countries WHERE code = 'MX'
      UNION ALL
      SELECT id, 'Medellín', 'America/Bogota', 1 FROM rooms.countries WHERE code = 'CO'
      UNION ALL
      SELECT id, 'Charlotte', 'America/New_York', 1 FROM rooms.countries WHERE code = 'US'
    `);

    // Seed: offices (una por ciudad)
    await queryRunner.query(`
      INSERT INTO rooms.offices (city_id, name)
      SELECT id, 'Oficina ' || name FROM rooms.cities
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rooms.office_admins`);
    await queryRunner.query(`DROP TABLE IF EXISTS rooms.bookings`);
    await queryRunner.query(`DROP TABLE IF EXISTS rooms.rooms`);
    await queryRunner.query(`DROP TABLE IF EXISTS rooms.offices`);
    await queryRunner.query(`DROP TABLE IF EXISTS rooms.cities`);
    await queryRunner.query(`DROP TABLE IF EXISTS rooms.countries`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS rooms CASCADE`);
  }
}
