# Mythoria Admin Portal - API Reference

## Overview

The Mythoria Admin Portal provides a comprehensive set of API endpoints for administrative operations. All APIs are built using Next.js API routes and require proper authentication and authorization.

## Authentication

### Authentication Method

All API endpoints use **NextAuth.js v5 (Auth.js)** with Google OAuth 2.0 provider.

### Domain Restrictions

Access is restricted to the following domains:

- `@mythoria.pt`
- `@caravanconcierge.com`

### Authentication Headers

```typescript
// Headers required for authenticated requests
const headers = {
  Authorization: 'Bearer <jwt-token>',
  'Content-Type': 'application/json',
};
```

### Session Management

```typescript
// Get current session
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';

const session = await getServerSession(authOptions);
if (!session) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
```

## Core API Endpoints

### 1. Health Check API

#### GET /api/health

Monitor system health and database connectivity.

**Parameters:**

- `debug` (optional): Set to `true` for detailed diagnostics

**Response:**

```typescript
interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  databases: {
    mythoria: { status: 'connected' | 'disconnected'; error?: string };
    workflows: { status: 'connected' | 'disconnected'; error?: string };
    backoffice: { status: 'connected' | 'disconnected'; error?: string };
  };
  network: {
    status: 'connected' | 'disconnected';
    publicDomain: string;
    error?: string;
  };
  debug?: {
    environment: string;
    nodeVersion: string;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
}
```

**Example:**

```bash
curl -X GET "https://admin.mythoria.pt/api/health?debug=true"
```

### 2. User Management API

#### GET /api/users

Retrieve user list with pagination and filtering.

**Query Parameters:**

- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `search` (string): Search users by name or email
- `status` (string): Filter by user status (`active`, `inactive`, `suspended`)
- `role` (string): Filter by user role

**Response:**

```typescript
interface UsersResponse {
  users: User[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

interface User {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
  storiesCount: number;
}
```

#### GET /api/users/[id]

Get detailed information about a specific user.

**Response:**

```typescript
interface UserDetails extends User {
  profile: {
    bio?: string;
    preferences: Record<string, any>;
    subscription: {
      plan: string;
      status: string;
      expiresAt: string | null;
    };
  };
  statistics: {
    totalStories: number;
    totalWords: number;
    totalImages: number;
    totalAudioMinutes: number;
    lastActivity: string;
  };
  recentActivity: Activity[];
}
```

#### PATCH /api/users/[id]

Update user information.

**Request Body:**

```typescript
interface UpdateUserRequest {
  name?: string;
  status?: 'active' | 'inactive' | 'suspended';
  role?: string;
  preferences?: Record<string, any>;
}
```

#### DELETE /api/users/[id]

Delete or deactivate a user account.

**Query Parameters:**

- `hard` (boolean): Permanently delete vs. soft delete (default: false)

### 3. Content Management API

#### GET /api/stories

Retrieve stories with filtering and pagination.

**Query Parameters:**

- `page` (number): Page number
- `limit` (number): Items per page
- `author` (string): Filter by author ID
- `status` (string): Filter by story status
- `category` (string): Filter by story category
- `startDate` (string): Filter by creation date (ISO format)
- `endDate` (string): Filter by creation date (ISO format)

**Response:**

```typescript
interface StoriesResponse {
  stories: Story[];
  pagination: PaginationInfo;
}

interface Story {
  id: string;
  title: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  status: 'draft' | 'published' | 'archived';
  category: string;
  createdAt: string;
  updatedAt: string;
  statistics: {
    views: number;
    likes: number;
    shares: number;
    wordCount: number;
  };
}
```

#### GET /api/stories/[id]

Get detailed story information.

**Response:**

```typescript
interface StoryDetails extends Story {
  content: {
    chapters: Chapter[];
    images: Image[];
    audioFiles: AudioFile[];
  };
  metadata: {
    genre: string;
    tags: string[];
    targetAudience: string;
    estimatedReadingTime: number;
  };
  moderationStatus: {
    status: 'pending' | 'approved' | 'rejected';
    reviewedBy?: string;
    reviewedAt?: string;
    notes?: string;
  };
}
```

#### PATCH /api/stories/[id]

Update story status or metadata.

**Request Body:**

```typescript
interface UpdateStoryRequest {
  status?: 'draft' | 'published' | 'archived';
  moderationStatus?: 'pending' | 'approved' | 'rejected';
  moderationNotes?: string;
  category?: string;
  tags?: string[];
}
```

#### DELETE /api/stories/[id]

Delete a story.

### 4. Workflow Management API

#### GET /api/workflows

Get workflow execution history and status.

**Query Parameters:**

- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Filter by workflow status
- `storyId` (string): Filter by story ID
- `startDate` (string): Filter by execution date
- `endDate` (string): Filter by execution date

**Response:**

```typescript
interface WorkflowsResponse {
  workflows: WorkflowRun[];
  pagination: PaginationInfo;
}

interface WorkflowRun {
  runId: string;
  storyId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  steps: WorkflowStep[];
  tokenUsage: {
    totalTokens: number;
    cost: number;
  };
}
```

#### GET /api/workflows/[runId]

Get detailed workflow execution information.

#### POST /api/workflows/[runId]/cancel

Cancel a running workflow.

#### GET /api/workflows/token-usage

Get token usage analytics.

**Query Parameters:**

- `period` (string): Time period (`day`, `week`, `month`, `year`)
- `groupBy` (string): Group by (`day`, `week`, `month`, `story`, `user`)

**Response:**

```typescript
interface TokenUsageResponse {
  period: string;
  totalTokens: number;
  totalCost: number;
  breakdown: {
    date: string;
    tokens: number;
    cost: number;
    stories: number;
  }[];
  topUsers: {
    userId: string;
    userName: string;
    tokens: number;
    cost: number;
  }[];
}
```

### 5. Analytics API

#### GET /api/analytics/dashboard

Get dashboard analytics data.

**Response:**

```typescript
interface DashboardAnalytics {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalStories: number;
    publishedStories: number;
    totalTokensUsed: number;
    totalCost: number;
  };
  trends: {
    userGrowth: DataPoint[];
    storyCreation: DataPoint[];
    tokenUsage: DataPoint[];
    engagement: DataPoint[];
  };
  recentActivity: Activity[];
}

interface DataPoint {
  date: string;
  value: number;
}
```

#### GET /api/analytics/users

Get user analytics.

**Query Parameters:**

- `period` (string): Time period
- `metric` (string): Metric type (`growth`, `engagement`, `retention`)

#### GET /api/analytics/content

Get content analytics.

**Query Parameters:**

- `period` (string): Time period
- `metric` (string): Metric type (`creation`, `engagement`, `quality`)

### 6. System Configuration API

#### GET /api/admin/config

Get system configuration settings.

**Response:**

```typescript
interface SystemConfig {
  features: {
    userRegistration: boolean;
    storySharing: boolean;
    aiGeneration: boolean;
    notifications: boolean;
  };
  limits: {
    maxStoriesPerUser: number;
    maxStoryLength: number;
    maxImageGenerations: number;
    maxAudioMinutes: number;
  };
  ai: {
    providers: string[];
    defaultModel: string;
    tokenLimits: Record<string, number>;
  };
}
```

#### PATCH /api/admin/config

Update system configuration.

#### GET /api/admin/audit-logs

Get audit log entries.

**Query Parameters:**

- `page` (number): Page number
- `limit` (number): Items per page
- `action` (string): Filter by action type
- `userId` (string): Filter by user ID
- `startDate` (string): Filter by date range
- `endDate` (string): Filter by date range

**Response:**

```typescript
interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: PaginationInfo;
}

interface AuditLog {
  id: string;
  action: string;
  userId: string;
  userName: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, any>;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
}
```

## Database API Integration

### Multi-Database Access Pattern

```typescript
// Database connection management
import { mythoria_db, workflows_db, backoffice_db } from '@/db';

// Example: Get user with workflow history
const getUserWithWorkflows = async (userId: string) => {
  const [user] = await mythoria_db.select().from(users).where(eq(users.id, userId));

  const workflows = await workflows_db
    .select()
    .from(story_generation_runs)
    .where(eq(story_generation_runs.author_id, userId));

  return { user, workflows };
};
```

### Database Health Monitoring

```typescript
// Health check implementation
const checkDatabaseHealth = async () => {
  const checks = await Promise.allSettled([
    mythoria_db.select().from(users).limit(1),
    workflows_db.select().from(story_generation_runs).limit(1),
    backoffice_db.select().from(admin_users).limit(1),
  ]);

  return {
    mythoria: checks[0].status === 'fulfilled',
    workflows: checks[1].status === 'fulfilled',
    backoffice: checks[2].status === 'fulfilled',
  };
};
```

## Error Handling

### Standard Error Response Format

```typescript
interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: any;
  timestamp: string;
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

### Error Handling Example

```typescript
// API route error handling
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 },
      );
    }

    // API logic here
  } catch (error) {
    console.error('API Error:', error);
    return Response.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
```

## Rate Limiting

### Rate Limit Configuration

```typescript
// Rate limiting middleware
const rateLimiter = new Map();

const rateLimit = (limit: number, windowMs: number) => {
  return (req: Request) => {
    const identifier = getClientIP(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    const requests = rateLimiter.get(identifier) || [];
    const validRequests = requests.filter((time: number) => time > windowStart);

    if (validRequests.length >= limit) {
      throw new Error('Rate limit exceeded');
    }

    validRequests.push(now);
    rateLimiter.set(identifier, validRequests);
  };
};
```

## Webhook Support

### Webhook Endpoints

#### POST /api/webhooks/workflow-complete

Handle workflow completion notifications.

#### POST /api/webhooks/user-activity

Handle user activity events.

### Webhook Security

```typescript
// Webhook signature verification
const verifyWebhookSignature = (payload: string, signature: string, secret: string) => {
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
};
```

---

**API Reference Version**: 1.0.0  
**Last Updated**: June 29, 2025  
**Service**: Mythoria Admin Portal v0.1.0+
