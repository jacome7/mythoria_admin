import { readFile } from 'node:fs/promises';
import { config as loadEnvironment } from 'dotenv';
import { Pool } from 'pg';
import { getMultiDatabaseConfig, getPoolConfig } from '@/lib/database-config';

loadEnvironment({ path: '.env.local', quiet: true });

const sqlPath = new URL('./email-campaign-engagement-migration.sql', import.meta.url);
const migrationSql = await readFile(sqlPath, 'utf8');
const config = getMultiDatabaseConfig();
const pool = new Pool(getPoolConfig(config.backoffice));
const client = await pool.connect();

try {
  await client.query('BEGIN');
  await client.query(migrationSql);
  await client.query('COMMIT');
  console.log('Email campaign engagement migration applied successfully.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
