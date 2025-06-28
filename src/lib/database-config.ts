// Multi-database configuration for Mythoria Admin Portal
// Manages connections to mythoria_db, workflows_db, and backoffice_db

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean | { rejectUnauthorized: boolean };
  maxConnections: number;
  connectionString?: string;
}

export interface MultiDatabaseConfig {
  mythoria: DatabaseConfig;
  workflows: DatabaseConfig;
  backoffice: DatabaseConfig;
}

/**
 * Determines if we're using VPC Direct Egress (private IP connection)
 */
export function isVpcDirectEgress(): boolean {
  return process.env.DB_HOST === "10.19.192.3" || (process.env.DB_HOST?.startsWith("10.") ?? false);
}

/**
 * Gets the base database configuration shared across all databases
 */
function getBaseDatabaseConfig(): Omit<DatabaseConfig, 'database'> {
  const isVpcConnection = isVpcDirectEgress();
  const isProduction = process.env.NODE_ENV === "production";
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';
  
  // During build time, provide default values to prevent build failures
  if (isBuildTime) {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'build-time-placeholder',
      ssl: false,
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
    };
  }
  
  // Validate required environment variables for runtime
  if (!process.env.DB_PASSWORD) {
    throw new Error('Database password is required');
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD!,
    ssl: isVpcConnection ? false : { rejectUnauthorized: false },
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
  };
}

/**
 * Gets configuration for all three databases
 */
export function getMultiDatabaseConfig(): MultiDatabaseConfig {
  const baseConfig = getBaseDatabaseConfig();
  
  return {
    mythoria: {
      ...baseConfig,
      database: process.env.MYTHORIA_DB_NAME || 'mythoria_db',
    },
    workflows: {
      ...baseConfig,
      database: process.env.WORKFLOWS_DB_NAME || 'workflows_db',
    },
    backoffice: {
      ...baseConfig,
      database: process.env.BACKOFFICE_DB_NAME || 'backoffice_db',
    },
  };
}

/**
 * Gets pool configuration for a specific database
 */
export function getPoolConfig(dbConfig: DatabaseConfig) {
  const isVpcConnection = isVpcDirectEgress();
  
  return {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    ssl: dbConfig.ssl,
    max: dbConfig.maxConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // Add retry logic for VPC connections
    ...(isVpcConnection && {
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    }),
  };
}
