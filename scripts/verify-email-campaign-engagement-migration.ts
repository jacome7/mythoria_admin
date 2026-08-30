import { config as loadEnvironment } from 'dotenv';
import { Pool } from 'pg';
import { getMultiDatabaseConfig, getPoolConfig } from '@/lib/database-config';

loadEnvironment({ path: '.env.local', quiet: true });

const POSTFLIGHT = process.argv.includes('--postflight');
const EXPECTED_COLUMNS = [
  ['marketing_campaigns', 'audience_total_snapshot'],
  ['marketing_campaigns', 'audience_snapshot_at'],
  ['marketing_campaign_recipients', 'tracking_enabled_at'],
  ['marketing_campaign_recipients', 'opened_at'],
  ['marketing_campaign_recipients', 'clicked_at'],
] as const;

const config = getMultiDatabaseConfig();
const pool = new Pool(getPoolConfig(config.backoffice));

try {
  const [identity, columns, counts] = await Promise.all([
    pool.query(
      `select current_database() as database, inet_server_addr()::text as server_address,
              current_schema() as schema`,
    ),
    pool.query(
      `select table_name, column_name, data_type, is_nullable
       from information_schema.columns
       where table_schema = 'public'
         and (table_name, column_name) in (
           ('marketing_campaigns', 'audience_total_snapshot'),
           ('marketing_campaigns', 'audience_snapshot_at'),
           ('marketing_campaign_recipients', 'tracking_enabled_at'),
           ('marketing_campaign_recipients', 'opened_at'),
           ('marketing_campaign_recipients', 'clicked_at')
         )
       order by table_name, column_name`,
    ),
    pool.query(
      `select
         (select count(*)::bigint from marketing_campaigns) as campaigns,
         (select count(*)::bigint from marketing_campaign_recipients) as recipients`,
    ),
  ]);
  const foundColumns = new Set(
    columns.rows.map((row) => `${String(row.table_name)}.${String(row.column_name)}`),
  );
  const expectedColumnCount = POSTFLIGHT ? EXPECTED_COLUMNS.length : 0;
  const verified =
    identity.rows[0]?.database === config.backoffice.database &&
    columns.rows.length === expectedColumnCount &&
    (POSTFLIGHT ||
      EXPECTED_COLUMNS.every(([table, column]) => !foundColumns.has(`${table}.${column}`)));

  console.log(
    JSON.stringify(
      {
        verified,
        phase: POSTFLIGHT ? 'postflight' : 'preflight',
        identity: identity.rows,
        rowCounts: counts.rows,
        columns: columns.rows,
      },
      null,
      2,
    ),
  );
  if (!verified) process.exitCode = 1;
} finally {
  await pool.end();
}
