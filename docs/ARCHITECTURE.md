# Mythoria Admin Portal - Architecture

## Overview

The Mythoria Admin Portal is the administrative interface for the Mythoria platform, built as a Next.js application that provides comprehensive management capabilities for users, content, workflows, and system monitoring. It serves as the central hub for platform administrators to oversee and manage all aspects of the Mythoria ecosystem.

## System Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Administrators │───►│  Load Balancer   │───►│  Mythoria       │
│   (Web Only)    │    │  (Cloud Run)     │    │ Admin Portal    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                       ┌─────────────────────────────────┼─────────────────────┐
                       │                                 │                     │
                       ▼                                 ▼                     ▼
              ┌─────────────────┐              ┌─────────────────┐    ┌─────────────────┐
              │   Google OAuth  │              │   PostgreSQL    │    │    External     │
              │ Authentication  │              │  Multi-Database │    │   Services      │
              │ (Domain-Restricted)│           │   (3 Databases) │    │ (SGW, Engine)   │
              └─────────────────┘              └─────────────────┘    └─────────────────┘
```

### Component Architecture

```
mythoria-admin/
├── Frontend Layer (React/Next.js)
│   ├── Pages & Routing (App Router)
│   ├── Admin UI Components (Tailwind CSS + DaisyUI)
│   ├── State Management (React Context)
│   └── Client-Side Admin Logic
│
├── API Layer (Next.js API Routes)
│   ├── Authentication Middleware (NextAuth.js)
│   ├── Route Handlers
│   ├── Admin-specific Validation
│   └── Multi-Database Integration
│
├── Business Logic Layer
│   ├── User Management (CRUD Operations)
│   ├── Content Management
│   ├── System Monitoring
│   ├── Workflow Management
│   └── Analytics & Reporting
│
└── Data Layer
    ├── Multi-Database Models (Drizzle ORM)
    │   ├── Mythoria DB (Main Application Data)
    │   ├── Workflows DB (Workflow Management)
    │   └── Backoffice DB (Admin-specific Data)
    ├── Database Migrations
    └── Data Access Logic
```

### Multi-Database Architecture

```
┌─────────────────┐
│  Admin Portal   │
└─────────────────┘
         │
         ├─────────────────────────────────────────────┐
         │                                             │
         ▼                                             ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   mythoria_db   │    │  workflows_db   │    │  backoffice_db  │
│  (Main Data)    │    │ (Workflows)     │    │ (Admin Data)    │
│                 │    │                 │    │                 │
│ • users         │    │ • runs          │    │ • admin_users   │
│ • stories       │    │ • steps         │    │ • audit_logs    │
│ • content       │    │ • token_usage   │    │ • system_config │
│ • notifications │    │                 │    │ • reports       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Technology Stack

### Core Framework

- **Next.js 15.3.4** - Full-stack React framework with App Router
- **React 19.1.0** - UI library with latest concurrent features
- **TypeScript 5** - Type safety and enhanced developer experience

### Authentication & Security

- **NextAuth.js v5 (Auth.js)** - Authentication framework
- **Google OAuth 2.0** - Identity provider
- **Domain Restriction** - Limited to `@mythoria.pt` and `@caravanconcierge.com`
- **JWT Strategy** - Secure session management

### Styling & UI

- **Tailwind CSS 4** - Utility-first CSS framework
- **DaisyUI 5.0.43** - Component library for Tailwind
- **Custom Admin Theme** - Tailored for administrative interfaces

### Database & ORM

- **Drizzle ORM 0.44.2** - Type-safe database operations
- **PostgreSQL** - Primary database system
- **Connection Pooling** - Optimized database connections
- **Multi-Database Support** - Independent connections to 3 databases

### Development & Testing

- **Jest** - Testing framework
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Turbopack** - Fast development builds

### Deployment & Infrastructure

- **Docker** - Containerization
- **Google Cloud Run** - Serverless container platform
- **Google Cloud Build** - CI/CD pipeline
- **VPC Connectivity** - Secure database access

## Core Features

### User Management

- **User Account Administration** - View, edit, and manage user accounts
- **Role-Based Access Control** - Define and assign user roles
- **Account Status Management** - Enable, disable, or suspend accounts
- **User Activity Monitoring** - Track user actions and engagement

### Content Management

- **Story Administration** - Manage user-generated stories
- **Content Moderation** - Review and moderate platform content
- **Asset Management** - Handle images, audio, and other media
- **Bulk Operations** - Perform actions on multiple items

### System Monitoring

- **Health Checks** - Monitor system and database health
- **Performance Metrics** - Track application performance
- **Error Monitoring** - Centralized error tracking and alerting
- **Usage Analytics** - Platform usage statistics and insights

### Workflow Management

- **AI Workflow Oversight** - Monitor story generation workflows
- **Token Usage Tracking** - Track and analyze AI token consumption
- **Processing Status** - View workflow execution status
- **Error Resolution** - Troubleshoot and resolve workflow issues

## Database Schema

### Mythoria Database (mythoria_db)

Primary application database containing:

- User accounts and profiles
- Story content and metadata
- Generated content (text, images, audio)
- User preferences and settings
- Notification history

### Workflows Database (workflows_db)

Workflow management database containing:

- Workflow execution runs
- Step-by-step processing logs
- Token usage tracking
- Performance metrics
- Error logs and diagnostics

### Backoffice Database (backoffice_db)

Admin-specific database containing:

- Administrator accounts
- Audit logs and activity tracking
- System configuration
- Reports and analytics
- Admin-specific content

## API Architecture

### Authentication Flow

```
1. User visits admin portal
2. Redirected to Google OAuth
3. Domain validation (mythoria.pt/caravanconcierge.com)
4. Email verification check
5. JWT token generation
6. Session establishment
7. Access granted to admin interface
```

### API Route Structure

```
/api/
├── auth/
│   └── [...nextauth]/         # NextAuth.js authentication
├── health/                    # System health checks
├── users/                     # User management
├── stories/                   # Content management
├── workflows/                 # Workflow management
├── analytics/                 # Analytics and reporting
└── admin/                     # Admin-specific operations
```

### Database Connection Management

```typescript
// Multi-database connection pattern
const connections = {
  mythoria: drizzle(mythoria_pool),
  workflows: drizzle(workflows_pool),
  backoffice: drizzle(backoffice_pool),
};

// Health check implementation
const checkDatabaseHealth = async () => {
  const results = await Promise.allSettled([
    connections.mythoria.select().from(users).limit(1),
    connections.workflows.select().from(runs).limit(1),
    connections.backoffice.select().from(admin_users).limit(1),
  ]);

  return {
    mythoria: results[0].status === 'fulfilled',
    workflows: results[1].status === 'fulfilled',
    backoffice: results[2].status === 'fulfilled',
  };
};
```

## Security Architecture

### Authentication Security

- **OAuth 2.0 with Google** - Industry-standard authentication
- **Domain Restriction** - Server-side validation of email domains
- **Email Verification** - Mandatory email verification
- **JWT Tokens** - Secure session management

### API Security

- **Middleware Protection** - Route-level authentication
- **Input Validation** - Comprehensive request validation
- **Rate Limiting** - Protection against abuse
- **CORS Configuration** - Secure cross-origin requests

### Database Security

- **Connection Pooling** - Secure database connections
- **SQL Injection Prevention** - Parameterized queries via Drizzle ORM
- **Access Control** - Role-based database access
- **Audit Logging** - Comprehensive activity tracking

## Performance Optimization

### Frontend Optimization

- **Next.js 15 Optimizations** - Built-in performance features
- **Turbopack** - Fast development builds
- **Code Splitting** - Automatic code splitting
- **Image Optimization** - Next.js image optimization

### Backend Optimization

- **Connection Pooling** - Efficient database connections
- **Caching Strategies** - Strategic caching implementation
- **Lazy Loading** - On-demand data loading
- **Pagination** - Efficient data pagination

### Database Optimization

- **Indexed Queries** - Proper database indexing
- **Query Optimization** - Efficient database queries
- **Connection Management** - Optimized connection handling
- **Health Monitoring** - Proactive health checks

## Deployment Architecture

### Container Configuration

```dockerfile
# Multi-stage build for optimization
FROM node:22.21-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:22.21-alpine AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Cloud Run Configuration

```yaml
# Cloud Build configuration
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/mythoria-admin', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/mythoria-admin']
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'mythoria-admin'
      - '--image=gcr.io/$PROJECT_ID/mythoria-admin'
      - '--region=europe-west9'
      - '--platform=managed'
      - '--allow-unauthenticated'
```

### Environment Configuration

```bash
# Authentication
AUTH_SECRET=your-secret-key
NEXTAUTH_URL=https://your-admin-domain.com
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database connections
DB_HOST=10.19.192.3
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-password
MYTHORIA_DB=mythoria_db
WORKFLOWS_DB=workflows_db
BACKOFFICE_DB=backoffice_db
```

## Integration Points

### Service Integration

- **Story Generation Workflow** - Monitor and manage AI workflows
- **Notification Engine** - Send admin notifications
- **Main Web App** - User data synchronization

### External Services

- **Google Cloud Services** - Cloud Run, Cloud SQL, Cloud Storage
- **Authentication Services** - Google OAuth 2.0
- **Monitoring Services** - Health checks and metrics

---

**Architecture Version**: 1.0.0  
**Last Updated**: June 29, 2025  
**Service**: Mythoria Admin Portal v0.1.0+
