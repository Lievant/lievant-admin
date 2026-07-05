/**
 * Seed: Ingesta de documentos SGSI para ISOBOT
 *
 * Lee todos los PDF/DOCX/XLSX de uploads/sgsi/ (recursivo), detecta el
 * macroproceso desde el nombre de la carpeta padre, extrae el texto,
 * genera embeddings y los guarda en isobot.documents + isobot.document_chunks.
 *
 * Idempotente: reprocesar un archivo actualiza su documento (ON CONFLICT
 * sobre file_name) y reemplaza sus chunks.
 *
 * Ejecutar:
 *   npm run seed:isobot       (desde apps/api/)
 *
 * Prerequisito: colocar los documentos en
 *   <repo-root>/uploads/sgsi/ (organizados en subcarpetas por macroproceso)
 */

import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { IsobotIngestionService } from '../../modules/isobot/isobot-ingestion.service';

const SGSI_DIR = path.resolve(process.cwd(), '../../uploads/sgsi');
const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.xlsx']);
const OBSOLETE_DIR_PATTERN = /obsoleto/i;

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && OBSOLETE_DIR_PATTERN.test(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

// El macroproceso real es la carpeta numerada tipo "11. TECNOLOGÍAS DE LA
// INFORMACIÓN", no necesariamente el padre inmediato del archivo — puede
// haber subcarpetas de categoría en medio (Formatos/Políticas/Procedimiento/...).
const MACROPROCESS_PATTERN = /^\d+[.\s]/;

function macroprocessFor(filePath: string): string | null {
  const relative = path.relative(SGSI_DIR, filePath);
  const segments = relative.split(path.sep).slice(0, -1);

  const numbered = segments.find((seg) => MACROPROCESS_PATTERN.test(seg));
  if (numbered) return numbered;

  const parentDir = path.basename(path.dirname(filePath));
  return parentDir === path.basename(SGSI_DIR) ? null : parentDir;
}

const FILE_TIMEOUT_MS = 60_000;

// Nota: esto no cancela el trabajo en curso (extracción/embeddings siguen
// corriendo en segundo plano si pierden la carrera) — solo evita que un
// archivo atorado bloquee el resto del batch.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout después de ${ms}ms`)), ms);
    }),
  ]);
}

async function run(): Promise<void> {
  if (!fs.existsSync(SGSI_DIR)) {
    fs.mkdirSync(SGSI_DIR, { recursive: true });
    console.log(`\n📁  Carpeta creada: ${SGSI_DIR}`);
    console.log('   Coloca ahí los documentos del SGSI (PDF/DOCX/XLSX), organizados');
    console.log('   en subcarpetas por macroproceso, y vuelve a correr este seed.\n');
    return;
  }

  const files = walk(SGSI_DIR);
  if (files.length === 0) {
    console.log(`\n⚠️  No se encontraron archivos PDF/DOCX/XLSX en ${SGSI_DIR}\n`);
    return;
  }

  console.log(`\nProcesando ${files.length} archivo(s) desde ${SGSI_DIR}...\n`);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const ingestion = app.get(IsobotIngestionService);

  let processed = 0;
  let failed = 0;

  for (const filePath of files) {
    try {
      const result = await withTimeout(
        ingestion.processDocument(filePath, { macroprocess: macroprocessFor(filePath) }),
        FILE_TIMEOUT_MS,
      );
      console.log(`  ✓  ${result.fileName} → ${result.chunksCreated} chunks`);
      processed++;
    } catch (err) {
      console.error(`  ✗  ${path.basename(filePath)}: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  console.log(`\n─────────────────────────────────────────────`);
  console.log(`  Procesados: ${processed}`);
  console.log(`  Fallidos  : ${failed}`);
  console.log(`─────────────────────────────────────────────\n`);

  await app.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
