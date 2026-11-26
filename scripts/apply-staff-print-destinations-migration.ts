import { readFile } from 'node:fs/promises';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { getMultiDatabaseConfig, getPoolConfig } from '@/lib/database-config';

async function main() {
  config({ path: '.env.local', quiet: true });
  const sql = await readFile(
    new URL('./staff-print-destinations-migration.sql', import.meta.url),
    'utf8',
  );
  const pool = new Pool(getPoolConfig(getMultiDatabaseConfig().backoffice));
  try {
    await pool.query(sql);
    console.log('Staff print destinations schema is ready in the backoffice database.');
  } finally {
    await pool.end();
  }
}

void main().catch(() => {
  console.error('Staff print destinations migration failed.');
  process.exitCode = 1;
});
