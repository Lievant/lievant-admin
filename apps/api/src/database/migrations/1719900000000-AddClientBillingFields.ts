import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientBillingFields1719900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE clients.client_records
        ADD COLUMN IF NOT EXISTS billing_client_id UUID
          REFERENCES clients.client_records(id),
        ADD COLUMN IF NOT EXISTS end_client_notes TEXT
    `);

    await queryRunner.query(`
      ALTER TABLE clients.brands
        ADD COLUMN IF NOT EXISTS cor_client_id  VARCHAR(50),
        ADD COLUMN IF NOT EXISTS is_end_client  BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS notes          TEXT
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN clients.client_records.billing_client_id IS
        'Si este cliente es el beneficiario final del servicio pero la facturación va a otro cliente, aquí va el ID del cliente que factura'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN clients.brands.cor_client_id IS
        'ID del cliente en Cor cuando la marca es el cliente final registrado en Cor'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN clients.brands.is_end_client IS
        'True cuando esta marca representa al cliente final del servicio (ej: Dislicores bajo SM Digital)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE clients.brands
        DROP COLUMN IF EXISTS cor_client_id,
        DROP COLUMN IF EXISTS is_end_client,
        DROP COLUMN IF EXISTS notes
    `);

    await queryRunner.query(`
      ALTER TABLE clients.client_records
        DROP COLUMN IF EXISTS billing_client_id,
        DROP COLUMN IF EXISTS end_client_notes
    `);
  }
}
