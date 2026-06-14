import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVendorsSchema1718600000000 implements MigrationInterface {
  name = 'CreateVendorsSchema1718600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS vendors`);

    await queryRunner.query(`
      CREATE TABLE catalogs.vendor_categories (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100) NOT NULL,
        type        VARCHAR(20) NOT NULL
                      CHECK (type IN ('producto', 'servicio', 'mixto')),
        description TEXT,
        is_active   BOOLEAN NOT NULL DEFAULT true,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE vendors.vendors (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name                VARCHAR(255) NOT NULL,
        trade_name          VARCHAR(255),
        rfc                 VARCHAR(13) NOT NULL UNIQUE,
        category_id         UUID REFERENCES catalogs.vendor_categories(id),
        status              VARCHAR(20) NOT NULL DEFAULT 'activo'
                              CHECK (status IN ('activo', 'inactivo')),
        payment_terms_days  INTEGER DEFAULT 30,
        clabe               VARCHAR(512),
        bank_name           VARCHAR(100),
        bank_account        VARCHAR(512),
        notes               TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at          TIMESTAMPTZ,
        created_by          UUID NOT NULL,
        updated_by          UUID NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE vendors.vendor_products (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id   UUID NOT NULL REFERENCES vendors.vendors(id),
        name        VARCHAR(255) NOT NULL,
        type        VARCHAR(20) NOT NULL
                      CHECK (type IN ('producto', 'servicio')),
        description TEXT,
        unit_price  NUMERIC(12,2),
        currency    VARCHAR(3) NOT NULL DEFAULT 'MXN',
        is_active   BOOLEAN NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by  UUID NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE vendors.purchase_orders (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        po_number     VARCHAR(20) NOT NULL UNIQUE,
        vendor_id     UUID NOT NULL REFERENCES vendors.vendors(id),
        status        VARCHAR(20) NOT NULL DEFAULT 'borrador'
                        CHECK (status IN ('borrador', 'aprobada', 'cerrada')),
        notes         TEXT,
        subtotal      NUMERIC(12,2) NOT NULL DEFAULT 0,
        tax           NUMERIC(12,2) NOT NULL DEFAULT 0,
        total         NUMERIC(12,2) NOT NULL DEFAULT 0,
        approved_at   TIMESTAMPTZ,
        closed_at     TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at    TIMESTAMPTZ,
        created_by    UUID NOT NULL,
        updated_by    UUID NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE vendors.po_line_items (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        po_id       UUID NOT NULL REFERENCES vendors.purchase_orders(id) ON DELETE CASCADE,
        product_id  UUID REFERENCES vendors.vendor_products(id),
        description VARCHAR(500) NOT NULL,
        quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
        unit_price  NUMERIC(12,2) NOT NULL,
        total       NUMERIC(12,2) NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE vendors.invoices (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id       UUID NOT NULL REFERENCES vendors.vendors(id),
        po_id           UUID REFERENCES vendors.purchase_orders(id),
        invoice_number  VARCHAR(100) NOT NULL,
        amount          NUMERIC(12,2) NOT NULL,
        tax             NUMERIC(12,2) NOT NULL DEFAULT 0,
        total           NUMERIC(12,2) NOT NULL,
        issue_date      DATE NOT NULL,
        due_date        DATE,
        status          VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                          CHECK (status IN ('pendiente', 'pagada')),
        pdf_s3_key      VARCHAR(500),
        notes           TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at      TIMESTAMPTZ,
        created_by      UUID NOT NULL,
        updated_by      UUID NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE vendors.payments (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id      UUID NOT NULL REFERENCES vendors.invoices(id),
        amount          NUMERIC(12,2) NOT NULL,
        payment_date    DATE NOT NULL,
        payment_method  VARCHAR(50),
        reference       VARCHAR(200),
        voucher_s3_key  VARCHAR(500),
        notes           TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by      UUID NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE vendors.vendor_documents (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id   UUID NOT NULL REFERENCES vendors.vendors(id),
        type        VARCHAR(50) NOT NULL,
        name        VARCHAR(255) NOT NULL,
        s3_key      VARCHAR(500) NOT NULL,
        file_size   INTEGER,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        uploaded_by UUID NOT NULL,
        deleted_at  TIMESTAMPTZ
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX idx_catalog_vendor_categories_active ON catalogs.vendor_categories(is_active)`);
    await queryRunner.query(`CREATE INDEX idx_vendors_vendors_category_id ON vendors.vendors(category_id)`);
    await queryRunner.query(`CREATE INDEX idx_vendors_vendors_status ON vendors.vendors(status)`);
    await queryRunner.query(`CREATE INDEX idx_vendors_vendor_products_vendor_id ON vendors.vendor_products(vendor_id)`);
    await queryRunner.query(`CREATE INDEX idx_vendors_purchase_orders_vendor_id ON vendors.purchase_orders(vendor_id)`);
    await queryRunner.query(`CREATE INDEX idx_vendors_purchase_orders_status ON vendors.purchase_orders(status)`);
    await queryRunner.query(`CREATE INDEX idx_vendors_po_line_items_po_id ON vendors.po_line_items(po_id)`);
    await queryRunner.query(`CREATE INDEX idx_vendors_po_line_items_product_id ON vendors.po_line_items(product_id)`);
    await queryRunner.query(`CREATE INDEX idx_vendors_invoices_vendor_id ON vendors.invoices(vendor_id)`);
    await queryRunner.query(`CREATE INDEX idx_vendors_invoices_po_id ON vendors.invoices(po_id)`);
    await queryRunner.query(`CREATE INDEX idx_vendors_invoices_status ON vendors.invoices(status)`);
    await queryRunner.query(`CREATE INDEX idx_vendors_payments_invoice_id ON vendors.payments(invoice_id)`);
    await queryRunner.query(`CREATE INDEX idx_vendors_vendor_documents_vendor_id ON vendors.vendor_documents(vendor_id)`);

    // Seed: vendor_categories
    await queryRunner.query(`
      INSERT INTO catalogs.vendor_categories (name, type, sort_order) VALUES
        ('Producción audiovisual', 'servicio', 0),
        ('Medios y pauta', 'servicio', 1),
        ('Tecnología y software', 'mixto', 2),
        ('Imprenta y materiales', 'producto', 3),
        ('Freelancers y consultores', 'servicio', 4),
        ('Legal y notarial', 'servicio', 5),
        ('Otros servicios', 'servicio', 6)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS vendors.vendor_documents`);
    await queryRunner.query(`DROP TABLE IF EXISTS vendors.payments`);
    await queryRunner.query(`DROP TABLE IF EXISTS vendors.invoices`);
    await queryRunner.query(`DROP TABLE IF EXISTS vendors.po_line_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS vendors.purchase_orders`);
    await queryRunner.query(`DROP TABLE IF EXISTS vendors.vendor_products`);
    await queryRunner.query(`DROP TABLE IF EXISTS vendors.vendors`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS vendors CASCADE`);

    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.vendor_categories`);
  }
}
