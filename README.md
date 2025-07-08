# Mythoria Admin Portal

The administrative interface for the Mythoria platform, providing comprehensive management capabilities for users, content, workflows, and system monitoring. Built with Next.js 15, TypeScript, and modern web technologies.

## Overview

The Mythoria Admin Portal serves as the centralized hub for platform administrators to oversee and manage all aspects of the Mythoria ecosystem. It provides secure, domain-restricted access to administrative functions including user management, content moderation, system monitoring, and AI workflow oversight.

## Key Features

### 🔐 **Secure Authentication**
- Google OAuth 2.0 with NextAuth.js v5
- Domain-restricted access (@mythoria.pt, @caravanconcierge.com)
- Server-side email verification
- JWT-based session management

### � **User Management**
- Complete user directory with search and filtering
- User account status management (active, inactive, suspended)
- Profile editing and preference management
- User activity monitoring and analytics
- Bulk operations for efficient management

### 📝 **Content Management**
- Story directory with advanced filtering
- Content moderation and approval workflows
- Media asset management (images, audio)
- Publication status control
- Content analytics and performance metrics

### � **System Monitoring**
- Real-time health checks for all databases
- Performance metrics and monitoring
- Error tracking and alerting
- System uptime monitoring
- Network connectivity verification

### 🤖 **AI Workflow Management**
- Workflow execution monitoring
- Token usage tracking and cost analysis
- AI service status monitoring
- Processing queue management
- Workflow error handling and resolution

### 📊 **Analytics & Reporting**
- Platform usage analytics
- User engagement metrics
- Content creation trends
- Cost analysis and optimization
- Custom report generation

### 🎫 **Ticketing System**
- Customer request management (contact, print, payment requests)
- Status tracking (open → in_progress → resolved → closed)
- Priority management and comment threads
- Notification system integration
- Comprehensive ticket analytics

## Tech Stack

### Core Framework
- **Next.js 15.3.4** - Full-stack React framework with App Router
- **React 19.1.0** - UI library with latest features
- **TypeScript 5** - Type safety and enhanced developer experience

### Authentication & Security
- **NextAuth.js v5** - Modern authentication framework
- **Google OAuth 2.0** - Secure identity provider
- **JWT Strategy** - Secure session management
- **Domain Restrictions** - Authorized access control

### Styling & UI
- **Tailwind CSS 4** - Utility-first CSS framework
- **DaisyUI 5.0.43** - Component library for Tailwind
- **Responsive Design** - Mobile-optimized interface

### Database & Backend
- **Drizzle ORM 0.44.2** - Type-safe database operations
- **PostgreSQL** - Multi-database support
  - `mythoria_db` - Main application data
  - `workflows_db` - AI workflow management
  - `backoffice_db` - Admin-specific data
- **Connection Pooling** - Optimized database performance

### Deployment & Infrastructure
- **Docker** - Containerized application
- **Google Cloud Run** - Serverless container platform
- **Google Cloud Build** - CI/CD pipeline
- **VPC Connectivity** - Secure database access

## Quick Start

### Prerequisites
- **Node.js 18+** and npm
- **PostgreSQL 14+** database access
- **Google OAuth 2.0 credentials** for authentication
- **Environment variables** configured

### Installation

```bash
# Clone and navigate to the admin portal
git clone <repository-url>
cd Mythoria/mythoria_admin

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Set up databases (if not already configured)
npm run db:setup

# Start development server
npm run dev
```

The admin portal will be available at `http://localhost:3001`

### Environment Configuration

Create `.env.local` with the following configuration:

```bash
# Authentication
AUTH_SECRET=your-super-secret-key
NEXTAUTH_URL=http://localhost:3001
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-database-password
MYTHORIA_DB=mythoria_dev
WORKFLOWS_DB=workflows_dev
BACKOFFICE_DB=backoffice_dev

# Development Settings
NODE_ENV=development
```

## Development Commands

### Application Commands
```bash
# Start development server (port 3001)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage
```

### Database Commands

### Database Commands
```bash
# Generate new migrations
npm run db:generate

# Run migrations
npm run db:migrate

# Push schema changes (development only)
npm run db:push

# Reset database
npm run db:reset

# Seed database with test data
npm run db:seed

# Complete database setup
npm run db:setup

# Open Drizzle Studio
npm run db:studio
```

## Project Structure

```
mythoria_admin/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (admin)/           # Admin route group
│   │   ├── api/               # API routes
│   │   ├── auth/              # Authentication pages
│   │   └── globals.css        # Global styles
│   ├── components/            # React components
│   ├── db/                    # Database layer
│   │   ├── schema/            # Database schemas
│   │   └── migrations/        # Migration files
│   ├── lib/                   # Utility functions
│   └── types/                 # TypeScript definitions
├── docs/                      # Documentation
├── public/                    # Static assets
├── __tests__/                 # Test files
└── [config files]
```

## Key Features in Detail

### Multi-Database Architecture
- **mythoria_db**: Main application data (users, stories, content)
- **workflows_db**: AI workflow management and token usage tracking  
- **backoffice_db**: Admin-specific data and audit logs

### Security Features
- Domain-restricted authentication (@mythoria.pt, @caravanconcierge.com)
- Server-side email verification
- JWT session management
- Role-based access control
- Comprehensive audit logging

### Monitoring Capabilities
- Real-time health checks for all databases
- System performance monitoring
- Error tracking and alerting
- Network connectivity verification
- AI token usage and cost tracking

## API Endpoints

The admin portal provides the following key API endpoints:

- `GET /api/health` - System health monitoring
- `GET /api/users` - User management
- `GET /api/stories` - Content management
- `GET /api/workflows` - AI workflow monitoring
- `GET /api/analytics/*` - Platform analytics

For complete API documentation, see [API Reference](./docs/api-reference.md).

## Deployment

### Production Deployment
```bash
# Deploy to Google Cloud Run
npm run deploy

# Or use PowerShell deployment script
./scripts/deploy.ps1
```

### Docker Deployment
```bash
# Build Docker image
docker build -t mythoria-admin .

# Run container locally
docker run -p 3001:3000 mythoria-admin
```

## Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[Architecture](./docs/ARCHITECTURE.md)** - System architecture and design patterns
- **[Features](./docs/features.md)** - Complete feature overview
- **[Development](./docs/DEVELOPMENT.md)** - Development setup and guidelines
- **[Authentication](./docs/authentication.md)** - Authentication system details
- **[API Reference](./docs/api-reference.md)** - Complete API documentation
- **[Deployment](./docs/deployment.md)** - Production deployment guide

## Support & Contributing

For support, questions, or contributions:

1. Check the [documentation](./docs/) for detailed guides
2. Review [implementation history](./docs/implementation/) for development context
3. Follow the development guidelines in [DEVELOPMENT.md](./docs/DEVELOPMENT.md)
4. Ensure all tests pass before submitting changes

## License

This project is part of the Mythoria platform. See the root [LICENSE](../LICENSE) file for details.

---

**Version**: 0.1.0  
**Last Updated**: June 29, 2025  
**Status**: Production Ready

## Project Structure

```
src/
├── app/                 # Next.js app router pages
├── components/          # Reusable UI components
├── db/                  # Database configuration and migrations
└── lib/                 # Utility functions and configurations
```

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# Database connections will be configured in Phase 3
# Authentication settings will be configured in Phase 4
```

## Development Phases

- ✅ **Phase 1**: Project structure and dependencies
- ✅ **Phase 2**: Deployment configuration and Cloud Run setup
- ⏳ **Phase 3**: Database connections (mythoria_db, workflows_db, backoffice_db)
- ⏳ **Phase 4**: Magic link authentication
- ⏳ **Phase 5**: Admin pages migration
- ⏳ **Phase 6**: Code cleanup

## Live Deployment

**Production URL**: https://mythoria-admin-803421888801.europe-west9.run.app

The admin portal is now live and accessible. Database connections and authentication will be configured in the next phases.

## License

Private project - All rights reserved.
