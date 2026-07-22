import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployeeDisplayIdSequence1720000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS employees.employee_display_id_seq
        START WITH 126
        INCREMENT BY 1
        NO MAXVALUE
        CACHE 1
    `);

    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS inventory.equipment_display_id_seq
        START WITH 417
        INCREMENT BY 1
        NO MAXVALUE
        CACHE 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SEQUENCE IF EXISTS inventory.equipment_display_id_seq`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS employees.employee_display_id_seq`);
  }
}
