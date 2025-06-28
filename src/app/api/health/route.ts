import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index";
import { sql } from "drizzle-orm";
import { isVpcDirectEgress } from "@/lib/database-config";

interface DatabaseStatus {
  status: "connected" | "disconnected";
  error?: string;
}

interface HealthStatus {
  status: "healthy" | "unhealthy";
  databases: {
    mythoria: DatabaseStatus;
    workflows: DatabaseStatus;
    backoffice: DatabaseStatus;
  };
  network: {
    status: "connected" | "disconnected";
    publicDomain?: string;
    error?: string;
  };
  timestamp: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const debug =
    searchParams.get("debug") === "true" || searchParams.get("debug") === "1";

  try {
    console.log("Admin portal health check starting...");
    
    // Test database connections
    const databaseResults = await Promise.allSettled([
      testDatabase("mythoria", db.mythoria),
      testDatabase("workflows", db.workflows),
      testDatabase("backoffice", db.backoffice),
    ]);

    const databases = {
      mythoria: getStatusFromResult(databaseResults[0]),
      workflows: getStatusFromResult(databaseResults[1]),
      backoffice: getStatusFromResult(databaseResults[2]),
    };

    // Test network connectivity to a public domain
    const networkResult = await testNetworkConnectivity();

    // Determine overall health
    const allDatabasesHealthy = Object.values(databases).every(
      db => db.status === "connected"
    );
    const networkHealthy = networkResult.status === "connected";
    const overallHealthy = allDatabasesHealthy && networkHealthy;

    const basicInfo: HealthStatus = {
      status: overallHealthy ? "healthy" : "unhealthy",
      databases,
      network: networkResult,
      timestamp: new Date().toISOString(),
    };

    if (debug) {
      const connectionType = isVpcDirectEgress()
        ? "VPC Direct Egress"
        : "Public IP";

      return NextResponse.json({
        ...basicInfo,
        debug: {
          connectionType,
          environment: process.env.NODE_ENV,
          dbHost: process.env.DB_HOST,
          mythoriaDbName: process.env.MYTHORIA_DB_NAME || 'mythoria_db',
          workflowsDbName: process.env.WORKFLOWS_DB_NAME || 'workflows_db',
          backofficeDbName: process.env.BACKOFFICE_DB_NAME || 'backoffice_db',
          isVpcConnection: isVpcDirectEgress(),
        },
      });
    }

    return NextResponse.json(basicInfo);
  } catch (error) {
    console.error("Health check failed:", error);

    const errorResponse: HealthStatus = {
      status: "unhealthy",
      databases: {
        mythoria: { status: "disconnected", error: "Health check failed" },
        workflows: { status: "disconnected", error: "Health check failed" },
        backoffice: { status: "disconnected", error: "Health check failed" },
      },
      network: {
        status: "disconnected",
        error: "Health check failed",
      },
      timestamp: new Date().toISOString(),
    };

    if (debug) {
      const connectionType = isVpcDirectEgress()
        ? "VPC Direct Egress"
        : "Public IP";

      return NextResponse.json(
        {
          ...errorResponse,
          debug: {
            connectionType,
            error: error instanceof Error ? error.message : "Unknown error",
            environment: process.env.NODE_ENV,
            dbHost: process.env.DB_HOST,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

async function testDatabase(
  name: string, 
  dbInstance: any
): Promise<{ name: string; result: any }> {
  if (!dbInstance) {
    throw new Error(`${name} database not initialized`);
  }
  
  console.log(`Testing ${name} database connection...`);
  const result = await dbInstance.execute(sql`SELECT 1 as test, NOW() as timestamp`);
  console.log(`${name} database connection test successful:`, result.rows?.[0]);
  return { name, result };
}

function getStatusFromResult(result: PromiseSettledResult<any>): DatabaseStatus {
  if (result.status === "fulfilled") {
    return { status: "connected" };
  } else {
    return {
      status: "disconnected",
      error: result.reason instanceof Error ? result.reason.message : "Unknown error",
    };
  }
}

async function testNetworkConnectivity(): Promise<{
  status: "connected" | "disconnected";
  publicDomain?: string;
  error?: string;
}> {
  try {
    console.log("Testing network connectivity...");
    
    const testDomain = "https://www.google.com";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(testDomain, {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log("Network connectivity test successful");
      return {
        status: "connected",
        publicDomain: testDomain,
      };
    } else {
      return {
        status: "disconnected",
        publicDomain: testDomain,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    console.error("Network connectivity test failed:", error);
    return {
      status: "disconnected",
      error: error instanceof Error ? error.message : "Unknown network error",
    };
  }
}
