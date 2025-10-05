# Mythoria Admin Portal - Development Guide

## Getting Started

This guide covers local development setup, contribution guidelines, and development best practices for the Mythoria Admin Portal.

## Prerequisites

### Required Software

- **Node.js 18+** - JavaScript runtime
- **npm** - Package manager
- **PostgreSQL 14+** - Database system
- **Git** - Version control
- **Docker** (optional) - For containerized development

### Required Services

- **Google Cloud Platform Account** - For deployment and services
- **Google OAuth 2.0 Credentials** - For authentication
- **Database Access** - To mythoria_db, workflows_db, and backoffice_db

## Local Development Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd Mythoria/mythoria_admin

# Install dependencies
npm install
```

### 2. Environment Configuration

Create `.env.local` file in the project root:

```bash
# Authentication
AUTH_SECRET=your-super-secret-key-here
NEXTAUTH_URL=http://localhost:3001
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-database-password

# Database Names
MYTHORIA_DB=mythoria_dev
WORKFLOWS_DB=workflows_dev
BACKOFFICE_DB=backoffice_dev

# Development Settings
NODE_ENV=development
LOG_LEVEL=debug
```

### 3. Database Setup

#### Local PostgreSQL Setup

```bash
# Create development databases
createdb mythoria_dev
createdb workflows_dev
createdb backoffice_dev

# Run migrations
npm run db:migrate

# Seed with development data (optional)
npm run db:seed
```

#### Using Cloud SQL Proxy (Alternative)

```bash
# Install Cloud SQL Proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.0.0/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy

# Start proxy connection
./cloud-sql-proxy oceanic-beach-460916-n5:europe-west9:mythoria-db-instance
```

### 4. Google OAuth Setup

1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**
2. **Navigate to APIs & Services > Credentials**
3. **Create OAuth 2.0 Client ID**
4. **Add authorized redirect URIs:**
   ```
   http://localhost:3001/api/auth/callback/google
   ```
5. **Add authorized origins:**
   ```
   http://localhost:3001
   ```

### 5. Start Development Server

```bash
# Start development server with Turbopack
npm run dev

# Server will be available at http://localhost:3001
```

## Development Workflow

### 1. Development Server Commands

```bash
# Start development server (port 3001)
npm run dev

# Start with specific port
npm run dev -- --port 3002

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### 2. Database Development Commands

```bash
# Generate new migration
npm run db:generate

# Run migrations
npm run db:migrate

# Push schema changes (development only)
npm run db:push

# Reset database
npm run db:reset

# Open Drizzle Studio
npm run db:studio

# Seed database with test data
npm run db:seed

# Complete database setup
npm run db:setup
```

### 3. Code Quality Commands

```bash
# Lint code
npm run lint

# Lint and fix
npm run lint -- --fix

# Format code (if Prettier is configured)
npm run format

# Type check
npx tsc --noEmit
```

## Project Structure

```
mythoria_admin/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (admin)/           # Admin route group
│   │   │   ├── dashboard/     # Dashboard pages
│   │   │   ├── users/         # User management
│   │   │   ├── stories/       # Content management
│   │   │   └── workflows/     # Workflow management
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Authentication
│   │   │   ├── health/        # Health checks
│   │   │   ├── users/         # User API
│   │   │   ├── stories/       # Content API
│   │   │   └── workflows/     # Workflow API
│   │   ├── auth/              # Auth pages
│   │   ├── globals.css        # Global styles
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Home page
│   ├── components/            # React components
│   │   ├── ui/                # Base UI components
│   │   ├── forms/             # Form components
│   │   ├── tables/            # Table components
│   │   └── charts/            # Chart components
│   ├── db/                    # Database layer
│   │   ├── schema/            # Database schemas
│   │   ├── migrations/        # Migration files
│   │   ├── index.ts           # Database connections
│   │   ├── migrate.ts         # Migration runner
│   │   └── seed.ts            # Seed data
│   ├── lib/                   # Utility functions
│   │   ├── auth.ts            # Auth utilities
│   │   ├── db.ts              # DB utilities
│   │   ├── utils.ts           # General utilities
│   │   └── validations.ts     # Validation schemas
│   └── types/                 # TypeScript type definitions
├── public/                    # Static assets
├── docs/                      # Documentation
├── __tests__/                 # Test files
├── .env.example               # Environment template
├── .env.local                 # Local environment (create this)
├── .gitignore                 # Git ignore rules
├── auth.ts                    # NextAuth configuration
├── drizzle.config.ts          # Drizzle configuration
├── next.config.ts             # Next.js configuration
├── package.json               # Dependencies
├── tailwind.config.ts         # Tailwind configuration
└── tsconfig.json              # TypeScript configuration
```

## Development Best Practices

### 1. Code Style

#### TypeScript Guidelines

```typescript
// Use strict typing
interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

// Avoid 'any' type
const processUser = (user: User): UserSummary => {
  return {
    id: user.id,
    displayName: user.name,
    memberSince: user.createdAt.getFullYear(),
  };
};

// Use proper error handling
const fetchUser = async (id: string): Promise<User | null> => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });
    return user || null;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('User fetch failed');
  }
};
```

#### React Component Guidelines

```typescript
// Use proper component patterns
interface UserCardProps {
  user: User;
  onEdit?: (user: User) => void;
  onDelete?: (userId: string) => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, onEdit, onDelete }) => {
  const handleEdit = useCallback(() => {
    onEdit?.(user);
  }, [user, onEdit]);

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">{user.name}</h2>
        <p className="text-base-content/70">{user.email}</p>
        <div className="card-actions justify-end">
          <button
            className="btn btn-primary btn-sm"
            onClick={handleEdit}
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
};
```

### 2. Database Development

#### Schema Management

```typescript
// Use Drizzle schema definitions
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const adminUsers = pgTable('admin_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull().default('admin'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Use type-safe queries
const getAdminUser = async (email: string) => {
  return await db.query.adminUsers.findFirst({
    where: eq(adminUsers.email, email),
  });
};
```

#### Migration Best Practices

```bash
# Always generate migrations for schema changes
npm run db:generate

# Review generated migration before applying
# Edit migration file if needed

# Apply migration
npm run db:migrate

# Never edit applied migrations
# Create new migration for additional changes
```

### 3. API Development

#### API Route Structure

```typescript
// src/app/api/users/route.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { z } from 'zod';

const getUsersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parameter validation
    const { searchParams } = new URL(request.url);
    const params = getUsersSchema.parse(Object.fromEntries(searchParams));

    // Business logic
    const users = await getUsersList(params);

    return Response.json(users);
  } catch (error) {
    console.error('API Error:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

### 4. Testing

#### Unit Testing

```typescript
// __tests__/lib/auth.test.ts
import { describe, it, expect } from '@jest/globals';
import { validateEmail } from '@/lib/auth';

describe('Auth Utilities', () => {
  describe('validateEmail', () => {
    it('should accept valid mythoria.pt emails', () => {
      expect(validateEmail('admin@mythoria.pt')).toBe(true);
    });

    it('should accept valid caravanconcierge.com emails', () => {
      expect(validateEmail('user@caravanconcierge.com')).toBe(true);
    });

    it('should reject other domains', () => {
      expect(validateEmail('user@gmail.com')).toBe(false);
    });
  });
});
```

#### API Testing

```typescript
// __tests__/api/users.test.ts
import { GET } from '@/app/api/users/route';
import { createRequest } from '@/test-utils';

describe('/api/users', () => {
  it('should return users list for authenticated admin', async () => {
    const request = createRequest('GET', '/api/users?page=1&limit=10');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('users');
    expect(data).toHaveProperty('pagination');
  });
});
```

### 5. Component Development

#### Component Structure

```typescript
// src/components/UserTable.tsx
interface UserTableProps {
  users: User[];
  loading?: boolean;
  onUserEdit: (user: User) => void;
  onUserDelete: (userId: string) => void;
}

export const UserTable: React.FC<UserTableProps> = ({
  users,
  loading = false,
  onUserEdit,
  onUserDelete
}) => {
  if (loading) {
    return <div className="loading loading-spinner loading-lg"></div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>
                <span className={`badge ${getStatusBadgeClass(user.status)}`}>
                  {user.status}
                </span>
              </td>
              <td>
                <div className="flex gap-2">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => onUserEdit(user)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-error btn-outline"
                    onClick={() => onUserDelete(user.id)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

## Debugging

### 1. Development Debugging

#### Browser Developer Tools

- Use React Developer Tools extension
- Monitor network requests in Network tab
- Check console for errors and warnings
- Use Application tab for storage inspection

#### Server-Side Debugging

```typescript
// Add debug logging
console.log('Debug info:', { userId, action, timestamp: new Date() });

// Use environment-based logging
if (process.env.NODE_ENV === 'development') {
  console.log('Development debug:', data);
}
```

### 2. Database Debugging

#### Query Debugging

```typescript
// Enable Drizzle query logging
import { drizzle } from 'drizzle-orm/node-postgres';

const db = drizzle(pool, {
  logger: process.env.NODE_ENV === 'development',
});

// Log slow queries
const startTime = Date.now();
const result = await db.query.users.findMany();
const duration = Date.now() - startTime;
if (duration > 1000) {
  console.warn(`Slow query detected: ${duration}ms`);
}
```

#### Health Check Debugging

```bash
# Test health endpoint
curl -X GET "http://localhost:3001/api/health?debug=true"

# Monitor database connections
npm run db:studio
```

### 3. Authentication Debugging

#### NextAuth Debugging

```bash
# Enable NextAuth debug mode
NEXTAUTH_DEBUG=true npm run dev
```

#### Session Debugging

```typescript
// Debug session in components
import { useSession } from 'next-auth/react';

const { data: session, status } = useSession();
console.log('Session status:', status);
console.log('Session data:', session);
```

## Performance Optimization

### 1. Frontend Performance

#### Component Optimization

```typescript
// Use React.memo for expensive components
const UserCard = React.memo<UserCardProps>(({ user, onEdit }) => {
  return (
    <div className="card">
      {/* Component content */}
    </div>
  );
});

// Use useMemo for expensive calculations
const sortedUsers = useMemo(() => {
  return users.sort((a, b) => a.name.localeCompare(b.name));
}, [users]);

// Use useCallback for event handlers
const handleUserEdit = useCallback((user: User) => {
  setEditingUser(user);
  setShowEditModal(true);
}, []);
```

#### Loading States

```typescript
// Implement proper loading states
const [users, setUsers] = useState<User[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      const data = await response.json();
      setUsers(data.users);
    } catch (err) {
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  fetchUsers();
}, []);
```

### 2. Database Performance

#### Query Optimization

```typescript
// Use indexes for frequent queries
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull().unique(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
    statusIdx: index('users_status_idx').on(table.status),
    createdAtIdx: index('users_created_at_idx').on(table.createdAt),
  }),
);

// Use pagination for large datasets
const getUsers = async (page: number, limit: number) => {
  return await db.query.users.findMany({
    limit,
    offset: (page - 1) * limit,
    orderBy: [desc(users.createdAt)],
  });
};
```

## Deployment

### 1. Local Production Build

```bash
# Build for production
npm run build

# Test production build locally
npm run start
```

### 2. Docker Development

```bash
# Build Docker image
docker build -t mythoria-admin-dev .

# Run container
docker run -p 3001:3000 \
  -e DATABASE_URL="your-db-url" \
  -e AUTH_SECRET="your-secret" \
  mythoria-admin-dev
```

### 3. Staging Deployment

```bash
# Deploy to staging
npm run deploy

# Monitor deployment
gcloud run logs tail mythoria-admin --region=europe-west9
```

## Troubleshooting

### Common Issues

#### Authentication Issues

```bash
# Check Google OAuth configuration
# Verify redirect URIs in Google Console
# Confirm environment variables are set
echo $GOOGLE_CLIENT_ID
echo $NEXTAUTH_URL
```

#### Database Connection Issues

```bash
# Test database connectivity
npm run db:studio

# Check database health
curl http://localhost:3001/api/health
```

#### Build Issues

```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

**Development Guide Version**: 1.0.0  
**Last Updated**: June 29, 2025  
**Service**: Mythoria Admin Portal v0.1.0+
