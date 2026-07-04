import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, sql } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(pool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__migrations')
    CREATE TABLE dbo.__migrations (
      filename NVARCHAR(255) NOT NULL PRIMARY KEY,
      applied_en DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `);
}

async function appliedMigrations(pool) {
  const result = await pool.request().query('SELECT filename FROM dbo.__migrations');
  return new Set(result.recordset.map((r) => r.filename));
}

// mssql no entiende el separador de lote "GO" (es una directiva de sqlcmd/SSMS, no T-SQL).
function splitBatches(fileContents) {
  return fileContents
    .split(/^\s*GO\s*$/im)
    .map((batch) => batch.trim())
    .filter(Boolean);
}

async function run() {
  const pool = await getPool();
  await ensureMigrationsTable(pool);
  const applied = await appliedMigrations(pool);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`(ya aplicada) ${file}`);
      continue;
    }
    console.log(`aplicando ${file}...`);
    const contents = readFileSync(path.join(migrationsDir, file), 'utf8');
    const batches = splitBatches(contents);

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      for (const batch of batches) {
        await new sql.Request(transaction).query(batch);
      }
      await new sql.Request(transaction)
        .input('filename', sql.NVarChar, file)
        .query('INSERT INTO dbo.__migrations (filename) VALUES (@filename)');
      await transaction.commit();
      console.log(`  ✓ ${file}`);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  console.log('Migraciones al día.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Error ejecutando migraciones:', err);
  process.exit(1);
});
