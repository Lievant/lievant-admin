import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Campo libre "Detalle" en las líneas de gasto de tarjeta. Opcional: no se
 * pidió obligatorio y las líneas históricas no tienen valor.
 */
export class AddCardExpenseLineDetail1751000000031 implements MigrationInterface {
  name = 'AddCardExpenseLineDetail1751000000031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE expenses.card_expense_lines ADD COLUMN IF NOT EXISTS detail VARCHAR(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE expenses.card_expense_lines DROP COLUMN IF EXISTS detail`,
    );
  }
}
