import { NextRequest, NextResponse } from "next/server";

interface ServiceConfiguration {
  name: string;
  displayName: string;
  baseUrl: string;
  healthPath: string;
}

const services: ServiceConfiguration[] = [
  {
    name: 'mythoria-webapp',
    displayName: 'Mythoria Web App',
    baseUrl: process.env.WEBAPP_URL || 'http://localhost:3000',
    healthPath: '/api/health'
  },
  {
    name: 'mythoria-admin',
    displayName: 'Mythoria Admin Portal',
    baseUrl: process.env.ADMIN_URL || 'http://localhost:3001',
    healthPath: '/api/health'
  },
  {
    name: 'story-generation-workflow',
    displayName: 'Story Generation Workflow',
    baseUrl: process.env.STORY_GENERATION_WORKFLOW_URL || 'http://localhost:8080',
    healthPath: '/health'
  },
  {
    name: 'notification-engine',
    displayName: 'Notification Engine',
    baseUrl: process.env.NOTIFICATION_ENGINE_URL || 'http://localhost:8081',
    healthPath: '/health'
  }
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceName = searchParams.get('service');
    
    // If specific service requested, check only that one
    if (serviceName) {
      const service = services.find(s => s.name === serviceName);
      if (!service) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      }
      
      const result = await checkServiceHealth(service);
      return NextResponse.json(result);
    }
    
    // Check all services
    const healthChecks = services.map(service => checkServiceHealth(service));
    const results = await Promise.allSettled(healthChecks);
    
    const serviceStatuses = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          service: services[index].name,
          displayName: services[index].displayName,
          status: 'unknown',
          url: services[index].baseUrl,
          healthEndpoint: `${services[index].baseUrl}${services[index].healthPath}`,
          lastChecked: new Date().toISOString(),
          error: result.reason?.message || 'Unknown error'
        };
      }
    });

    return NextResponse.json({
      services: serviceStatuses,
      timestamp: new Date().toISOString(),
      totalServices: services.length,
      healthyServices: serviceStatuses.filter(s => s.status === 'healthy').length
    });
    
  } catch (error) {
    console.error('Server status check failed:', error);
    return NextResponse.json(
      { error: 'Failed to check server status' },
      { status: 500 }
    );
  }
}

async function checkServiceHealth(service: ServiceConfiguration) {
  const healthUrl = `${service.baseUrl}${service.healthPath}`;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mythoria-Admin-Health-Check'
      },
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    let responseData = null;
    try {
      responseData = await response.json();
    } catch {
      // Response might not be JSON
    }

    // Check both HTTP status and response data status
    const isHealthy = response.ok && (
      !responseData || 
      responseData.status === 'healthy' || 
      responseData.status === 'connected'
    );
    
    return {
      service: service.name,
      displayName: service.displayName,
      status: isHealthy ? 'healthy' : 'unhealthy',
      url: service.baseUrl,
      healthEndpoint: healthUrl,
      responseTime,
      lastChecked: new Date().toISOString(),
      error: !isHealthy ? `HTTP ${response.status}: ${response.statusText}` : undefined,
      data: responseData
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      service: service.name,
      displayName: service.displayName,
      status: 'unhealthy',
      url: service.baseUrl,
      healthEndpoint: healthUrl,
      responseTime,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
