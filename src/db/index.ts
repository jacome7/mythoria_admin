import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getMultiDatabaseConfig, getPoolConfig, isVpcDirectEgress } from "@/lib/database-config";

// Check if we're in build time
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || process.env.NODE_ENV === 'test';

// Connection pools for each database
let mythoriaPool: Pool | null = null;
let workflowsPool: Pool | null = null;
let backofficePool: Pool | null = null;

// Drizzle instances for each database
let mythoriaDbInstance: ReturnType<typeof drizzle> | null = null;
let workflowsDbInstance: ReturnType<typeof drizzle> | null = null;
let backofficeDbInstance: ReturnType<typeof drizzle> | null = null;

function createPool(poolConfig: ReturnType<typeof getPoolConfig>, poolName: string): Pool {
  const pool = new Pool(poolConfig);
  
  pool.on('error', (err) => {
    console.error(`Unexpected error on idle client (${poolName}):`, err);
  });
  
  pool.on('connect', () => {
    if (isVpcDirectEgress()) {
      console.log(`Using VPC Direct Egress connection to Cloud SQL (${poolName})`);
    }
  });
  
  return pool;
}

function initializeDatabases(): {
  mythoria: ReturnType<typeof drizzle>;
  workflows: ReturnType<typeof drizzle>;
  backoffice: ReturnType<typeof drizzle>;
} | null {
  if (isBuildTime) {
    console.log('Build time detected - skipping database initialization');
    return null;
  }

  if (mythoriaPool && workflowsPool && backofficePool) {
    return {
      mythoria: mythoriaDbInstance!,
      workflows: workflowsDbInstance!,
      backoffice: backofficeDbInstance!,
    };
  }

  try {
    const config = getMultiDatabaseConfig();

    // Initialize mythoria database
    mythoriaPool = createPool(getPoolConfig(config.mythoria), 'mythoria');
    mythoriaDbInstance = drizzle(mythoriaPool);

    // Initialize workflows database  
    workflowsPool = createPool(getPoolConfig(config.workflows), 'workflows');
    workflowsDbInstance = drizzle(workflowsPool);

    // Initialize backoffice database
    backofficePool = createPool(getPoolConfig(config.backoffice), 'backoffice');
    backofficeDbInstance = drizzle(backofficePool);

    console.log('All database connections initialized successfully');
    
    return {
      mythoria: mythoriaDbInstance,
      workflows: workflowsDbInstance,
      backoffice: backofficeDbInstance,
    };
  } catch (error) {
    console.error('Failed to initialize databases:', error);
    throw error;
  }
}

// Initialize connections
const databases = initializeDatabases();

// Export individual database connections
export const mythoriaDb = databases?.mythoria || null;
export const workflowsDb = databases?.workflows || null;
export const backofficeDb = databases?.backoffice || null;

// Export getter functions for database connections
export function getMythoriaDb() {
  const currentDb = databases?.mythoria || mythoriaDbInstance;
  if (!currentDb) {
    throw new Error('Mythoria database not initialized');
  }
  return currentDb;
}

export function getWorkflowsDb() {
  const currentDb = databases?.workflows || workflowsDbInstance;
  if (!currentDb) {
    throw new Error('Workflows database not initialized');
  }
  return currentDb;
}

export function getBackofficeDb() {
  const currentDb = databases?.backoffice || backofficeDbInstance;
  if (!currentDb) {
    throw new Error('Backoffice database not initialized');
  }
  return currentDb;
}

// Export all databases as an object
export const db = {
  mythoria: mythoriaDb,
  workflows: workflowsDb,  
  backoffice: backofficeDb,
};

// Graceful shutdown
async function closeConnections() {
  const pools = [mythoriaPool, workflowsPool, backofficePool];
  const poolNames = ['mythoria', 'workflows', 'backoffice'];
  
  await Promise.all(
    pools.map(async (pool, index) => {
      if (pool) {
        try {
          await pool.end();
          console.log(`${poolNames[index]} database pool closed`);
        } catch (error) {
          console.error(`Error closing ${poolNames[index]} pool:`, error);
        }
      }
    })
  );
}

// Only register process handlers in Node.js environment (not Edge Runtime)
if (typeof process !== 'undefined' && process.on) {
  process.on('SIGINT', closeConnections);
  process.on('SIGTERM', closeConnections);
}
