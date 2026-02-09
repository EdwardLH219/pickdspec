# Vercel Deployment Guide

## Prerequisites

1. **PostgreSQL Database** - You'll need a hosted PostgreSQL database:
   - [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) (recommended)
   - [Neon](https://neon.tech/) (free tier available)
   - [Supabase](https://supabase.com/) (free tier available)
   - [Railway](https://railway.app/)

2. **Redis** (optional, for background jobs):
   - [Upstash Redis](https://upstash.com/) (serverless, recommended)
   - [Redis Cloud](https://redis.com/cloud/)
   - Note: Without Redis, the worker/queue features won't work, but the web app will function

## Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

### Required

```env
# Database (get from your PostgreSQL provider)
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"

# NextAuth.js
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="https://your-app.vercel.app"

# Encryption key for connector credentials (32 bytes hex)
ENCRYPTION_KEY="generate-with: openssl rand -hex 32"
```

### Optional (for full functionality)

```env
# Google OAuth (for Google login)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Redis (for background jobs)
REDIS_URL="redis://default:password@host:6379"

# Logging
LOG_LEVEL="info"
```

## Database Setup

### Option 1: Fresh Database (Recommended for Testing)

After connecting your database, the migration will run automatically on first deploy via the build command.

The `build` script in `package.json` runs:
```bash
prisma generate && next build
```

To also run migrations on build, update Vercel's build command to:
```bash
npx prisma migrate deploy && npm run build
```

Or add it to `package.json`:
```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

### Option 2: Manual Migration

Run migrations manually before first deploy:

```bash
# Set DATABASE_URL to your production database
export DATABASE_URL="postgresql://..."

# Run migrations
npx prisma migrate deploy

# (Optional) Seed with test data
npx prisma db seed
```

## Vercel Configuration

### 1. Import Project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Vercel will auto-detect Next.js

### 2. Configure Build

- **Framework Preset**: Next.js (auto-detected)
- **Build Command**: `npx prisma migrate deploy && npm run build`
- **Install Command**: `npm install` (default)
- **Output Directory**: `.next` (default)

### 3. Set Environment Variables

Add all required environment variables before first deploy.

### 4. Deploy

Click "Deploy" and wait for the build to complete.

## Post-Deployment

### Verify Health Endpoints

```bash
# Liveness probe
curl https://your-app.vercel.app/api/health/live

# Readiness probe (checks database)
curl https://your-app.vercel.app/api/health/ready

# Full health check
curl https://your-app.vercel.app/api/health
```

### Create Admin User

The seed script creates test users. For production, you'll want to:

1. Register via `/register`
2. Manually update the user to `PICKD_ADMIN` role:

```sql
UPDATE "User" 
SET role = 'PICKD_ADMIN', "isPickdStaff" = true 
WHERE email = 'your-email@example.com';
```

Or use Prisma Studio:
```bash
DATABASE_URL="your-prod-url" npx prisma studio
```

## Migration Files

The project includes:

```
prisma/
├── migrations/
│   └── 0_init/
│       └── migration.sql    # Initial schema (902 lines)
├── schema.prisma            # Prisma schema
└── seed.ts                  # Test data seeding
```

## Troubleshooting

### Migration Fails

If `prisma migrate deploy` fails:

1. Check DATABASE_URL is correct
2. Ensure database user has CREATE TABLE permissions
3. Check if schema already exists (may need to drop tables first for fresh start)

### Connection Issues

For serverless databases (Neon, Supabase), you may need:

```env
DATABASE_URL="postgresql://...?sslmode=require&connection_limit=1"
```

### Build Timeout

If build times out, run migrations separately:

```bash
# In local terminal with prod DATABASE_URL
npx prisma migrate deploy
```

Then deploy without migrations in build command.

## Worker Deployment (Optional)

The background worker (for score runs, ingestion) cannot run on Vercel's serverless functions. Options:

1. **Skip for testing** - Core functionality works without it
2. **Railway/Render** - Deploy `npm run start:worker` as a separate service
3. **Vercel Cron** - For simple scheduled tasks (limited)

## Security Notes

- Never commit `.env` files
- Use Vercel's environment variables
- Set `NEXTAUTH_URL` to your production domain
- Generate unique `NEXTAUTH_SECRET` and `ENCRYPTION_KEY` for production
