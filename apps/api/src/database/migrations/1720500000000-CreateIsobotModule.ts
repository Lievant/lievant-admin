import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIsobotModule1720500000000 implements MigrationInterface {
  name = 'CreateIsobotModule1720500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS isobot`);

    // ------------------------------------------------------------------ //
    // Documentos del SGSI
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS isobot.documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(300) NOT NULL,
        file_name VARCHAR(300) NOT NULL,
        s3_key VARCHAR(500),
        file_type VARCHAR(20),
        macroprocess VARCHAR(100),
        category VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ------------------------------------------------------------------ //
    // Chunks de texto con embeddings
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS isobot.document_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES isobot.documents(id),
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        token_count INTEGER,
        embedding vector(1536),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
        ON isobot.document_chunks
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 10)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_document_chunks_document
        ON isobot.document_chunks(document_id)
    `);

    // ------------------------------------------------------------------ //
    // Historial de conversaciones
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS isobot.conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id),
        user_name VARCHAR(200),
        user_area VARCHAR(100),
        started_at TIMESTAMPTZ DEFAULT NOW(),
        last_message_at TIMESTAMPTZ DEFAULT NOW(),
        message_count INTEGER DEFAULT 0
      )
    `);

    // ------------------------------------------------------------------ //
    // Mensajes del chat
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS isobot.messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES isobot.conversations(id),
        role VARCHAR(10) NOT NULL,
        content TEXT NOT NULL,
        sources JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation
        ON isobot.messages(conversation_id)
    `);

    // ------------------------------------------------------------------ //
    // auth.permissions seed
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('herramientas', 'isobot', 'read', 'Acceder al chatbot ISOBOT')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM auth.roles r, auth.permissions p
      WHERE p.module = 'isobot'
      AND p.id NOT IN (
        SELECT permission_id FROM auth.role_permissions rp
        JOIN auth.roles ro ON ro.id = rp.role_id
        WHERE ro.name = r.name
      )
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM auth.permissions WHERE module = 'isobot'`);
    await queryRunner.query(`DROP TABLE IF EXISTS isobot.messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS isobot.conversations`);
    await queryRunner.query(`DROP TABLE IF EXISTS isobot.document_chunks`);
    await queryRunner.query(`DROP TABLE IF EXISTS isobot.documents`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS isobot`);
  }
}
