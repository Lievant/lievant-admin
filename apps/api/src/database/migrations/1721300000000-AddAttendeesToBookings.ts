import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAttendeesToBookings1721300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE rooms.bookings ADD COLUMN IF NOT EXISTS attendees JSONB DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rooms.bookings DROP COLUMN IF EXISTS attendees`);
  }
}
