# Mythoria Admin Portal

Administrative portal for the Mythoria platform, built with Next.js 15, TailwindCSS, DaisyUI, and Drizzle ORM.

## Features

- 🎨 **Modern UI**: Built with TailwindCSS 4 and DaisyUI
- 🔧 **Database**: Drizzle ORM for type-safe database operations
- 🚀 **Performance**: Next.js 15 with standalone output for optimal Cloud Run deployment
- 🔐 **Security**: Magic link authentication system
- 📊 **Multi-Database**: Connects to mythoria_db, workflows_db, and backoffice_db

## Tech Stack

- **Framework**: Next.js 15.3.4
- **Styling**: TailwindCSS 4 + DaisyUI 5.0.43
- **Database**: Drizzle ORM 0.44.2 with PostgreSQL
- **Language**: TypeScript 5
- **Deployment**: Docker + Google Cloud Run

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Database Commands

```bash
# Generate migrations
npm run db:generate

# Run migrations
npm run db:migrate

# Push schema changes
npm run db:push

# Reset database
npm run db:reset

# Seed database
npm run db:seed

# Open Drizzle Studio
npm run db:studio
```

## Deployment

```bash
# Deploy to production
npm run deploy:production

# Or use PowerShell script
./scripts/deploy.ps1
```

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
- ⏳ **Phase 2**: Deployment configuration
- ⏳ **Phase 3**: Database connections (mythoria_db, workflows_db, backoffice_db)
- ⏳ **Phase 4**: Magic link authentication
- ⏳ **Phase 5**: Admin pages migration
- ⏳ **Phase 6**: Code cleanup

## License

Private project - All rights reserved.
