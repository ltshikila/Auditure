# Prisma Guide for BookCast Core API

This guide covers how Prisma is used in the BookCast project, including setup, development workflow, and common operations.

## Table of Contents

- [Overview](#overview)
- [Database Setup](#database-setup)
- [Development Workflow](#development-workflow)
- [Schema Management](#schema-management)
- [Common Operations](#common-operations)
- [Database Service](#database-service)
- [Troubleshooting](#troubleshooting)

## Overview

This project uses **Prisma v7** with the following stack:
- **ORM**: Prisma Client
- **Database**: PostgreSQL (via Prisma Dev for local development)
- **Driver Adapter**: `@prisma/adapter-pg` with `pg` driver
- **Configuration**: `prisma.config.ts` (new in Prisma v7)

### Key Files

- `prisma/schema.prisma` - Database schema definition
- `prisma.config.ts` - Prisma configuration (datasource URL, migrations path)
- `src/database/database.service.ts` - NestJS Prisma service
- `.env` - Environment variables (DATABASE_URL)

## Database Setup

### Starting the Development Database

For local development, we use Docker Compose with PostgreSQL:

```bash
# Start the database (recommended - uses npm script)
npm run db:start

# Or use docker-compose directly
docker-compose up -d

# The database will be available at:
# postgres://postgres:postgres@localhost:5432/bookcast
```

### Managing the Development Database

#### Using NPM Scripts (Recommended)

```bash
# Start PostgreSQL container
npm run db:start

# Stop PostgreSQL container (keeps data intact)
npm run db:stop

# Restart PostgreSQL container (keeps data intact)
npm run db:restart

# View database logs
npm run db:logs

# Seed database with test data
npm run db:seed

# Push schema changes to database
npm run db:push

# Open Prisma Studio GUI
npm run db:studio

# ⚠️ DESTRUCTIVE - Wipe database and reseed
npm run db:reset
```

#### Using Docker Compose Directly

```bash
# Start the database
docker-compose up -d

# Stop the database (keeps data intact)
docker-compose stop

# Restart the database (keeps data intact)
docker-compose restart

# View logs
docker-compose logs -f postgres

# ⚠️ WARNING: Removes volumes (deletes all data!)
docker-compose down -v
```

### Data Persistence

Your PostgreSQL data is stored in a Docker volume named `core-api_postgres_data`. This means:

#### ✅ Data PERSISTS When:
- Restarting the container: `npm run db:restart` or `docker-compose restart`
- Stopping/starting: `npm run db:stop` → `npm run db:start`
- Taking down the container: `docker-compose down` → `docker-compose up -d` (without `-v` flag)
- Restarting your computer

#### ❌ Data is DELETED When:
- Running: `npm run db:reset` (intentional reset with reseed)
- Running: `docker-compose down -v` (the `-v` flag removes volumes)
- Manually deleting: `docker volume rm core-api_postgres_data`
- Running: `docker volume prune` or `docker system prune --volumes`

**Best Practice**: Use `npm run db:stop` and `npm run db:start` to safely manage the database without losing data.

### Environment Configuration

Your `.env` file should contain:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bookcast?schema=public"
```

This connects to the PostgreSQL container running via Docker Compose.

### Applying Schema Changes

```bash
# Push schema changes to database (no migration files)
npm run db:push
# or
npx prisma db push

# Create a migration after schema changes (production approach)
npx prisma migrate dev --name description_of_change

# Apply all pending migrations (production deployment)
npx prisma migrate deploy

# Reset database and apply all migrations (WARNING: deletes all data)
npx prisma migrate reset
```

**Note**: This project currently uses `db push` for development. Use migrations for production deployments.

### Generating Prisma Client

After schema changes, regenerate the Prisma Client:

```bash
npx prisma generate
```

This is automatically done when you run migrations, but you can run it manually if needed.

### Using Prisma Studio

Prisma Studio provides a visual interface to view and edit your database:

```bash
# Start Prisma Studio (recommended - uses npm script)
npm run db:studio

# Or run directly
npx prisma studio
```

Prisma Studio will open in your browser at `http://localhost:5555` where you can:
- Browse all tables and records
- View relationships between models
- Add, edit, or delete data manually
- **View OTP codes** during development (found in the User table's `otpCode` field)
- Create test data quickly

## Development Workflow

### Making Schema Changes

1. **Edit the schema** in `prisma/schema.prisma`
2. **Push changes to database**:
   ```bash
   npm run db:push
   ```
3. **Generate Prisma Client** (if not auto-generated):
   ```bash
   npx prisma generate
   ```
4. **Restart your NestJS app** to pick up the changes

### Database Seeding

The project includes a seed script that populates the database with test data:

```bash
# Run seed script
npm run db:seed
```

**Seed Data Includes**:
- 2 test users (`test@bookcast.com` and `demo@bookcast.com`, password: `Password123`)
- 3 sample podcasters with different personalities
- 2 sample books with chapters

**Important**: The seed data is static. New data you create during testing won't be automatically added to the seed script. If you lose data after a database restart, run `npm run db:seed` to restore the baseline test data.

### Example: Adding a New Field

```prisma
model User {
  id               String    @id @default(uuid())
  email            String    @unique
  // ... existing fields

  // New field
  phoneNumber      String?   // Add new optional field

  @@map("users")
}
```

Then run:
```bash
npm run db:push
```

### Example: Adding a New Model

```prisma
model Podcast {
  id          String   @id @default(uuid())
  title       String
  description String?
  userId      String

  // Relations
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  episodes    Episode[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
  @@map("podcasts")
}
```

## Schema Management

### Current Schema Structure

The project has the following models:

**Note**: For the complete, up-to-date schema including the Podcaster model, see `prisma/schema.prisma`.

#### User Model
```prisma
model User {
  id               String    @id @default(uuid())
  email            String    @unique
  password         String
  firstName        String
  lastName         String
  dateOfBirth      DateTime?
  isEmailVerified  Boolean   @default(false)
  otpCode          String?
  otpExpiry        DateTime?
  refreshToken     String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  books            Book[]
}
```

#### Book Model
```prisma
model Book {
  id                String           @id @default(uuid())
  userId            String
  title             String
  author            String?
  isbn              String?
  language          String           @default("en")
  pageCount         Int?
  sourceType        SourceType
  originalFileName  String?
  fileStorageKey    String
  fileSize          Int?
  fileMimeType      String?
  extractionStatus  ExtractionStatus @default(PENDING)
  extractionError   String?
  extractedAt       DateTime?
  fullTextKey       String?
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  user              User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  chapters          Chapter[]
}
```

#### Chapter Model
```prisma
model Chapter {
  id              String    @id @default(uuid())
  bookId          String
  chapterNumber   Int
  title           String?
  startPage       Int?
  endPage         Int?
  textLength      Int?
  extractedText   String?   @db.Text
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  book            Book      @relation(fields: [bookId], references: [id], onDelete: Cascade)
}
```

### Enums

```prisma
enum SourceType {
  PDF
  EPUB
  URL
}

enum ExtractionStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  PARTIALLY_COMPLETED
}
```

## Common Operations

### Querying Data

```typescript
// Find unique user by email
const user = await this.databaseService.user.findUnique({
  where: { email: 'user@example.com' }
});

// Find with relations
const userWithBooks = await this.databaseService.user.findUnique({
  where: { id: userId },
  include: { books: true }
});

// Find many with filtering
const verifiedUsers = await this.databaseService.user.findMany({
  where: { isEmailVerified: true },
  orderBy: { createdAt: 'desc' },
  take: 10
});
```

### Creating Records

```typescript
// Create a user
const newUser = await this.databaseService.user.create({
  data: {
    email: 'user@example.com',
    password: hashedPassword,
    firstName: 'John',
    lastName: 'Doe',
    isEmailVerified: false
  }
});

// Create with relations
const book = await this.databaseService.book.create({
  data: {
    userId: user.id,
    title: 'Book Title',
    sourceType: 'PDF',
    fileStorageKey: 'path/to/file.pdf',
    extractionStatus: 'PENDING'
  }
});
```

### Updating Records

```typescript
// Update user
await this.databaseService.user.update({
  where: { id: userId },
  data: { isEmailVerified: true }
});

// Update with conditional logic
await this.databaseService.book.updateMany({
  where: {
    extractionStatus: 'PENDING',
    createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  },
  data: { extractionStatus: 'FAILED' }
});
```

### Deleting Records

```typescript
// Delete single record
await this.databaseService.user.delete({
  where: { id: userId }
});

// Delete with cascade (defined in schema)
// Deleting a user will automatically delete all their books and chapters
await this.databaseService.user.delete({
  where: { id: userId }
});
```

### Transactions

```typescript
// Using interactive transactions
await this.databaseService.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: { /* user data */ }
  });

  await tx.book.create({
    data: {
      userId: user.id,
      /* book data */
    }
  });
});

// Sequential operations
const [deletedBooks, deletedUser] = await this.databaseService.$transaction([
  this.databaseService.book.deleteMany({ where: { userId } }),
  this.databaseService.user.delete({ where: { id: userId } })
]);
```

## Database Service

### Implementation (Prisma v7)

The `DatabaseService` in this project extends `PrismaClient` and uses the PostgreSQL adapter:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Prisma v7 requires an adapter for PostgreSQL
    const pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'bookcast',
      user: 'postgres',
      password: 'postgres',
    });
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### Key Points

1. **PostgreSQL Adapter**: Prisma v7 requires a database driver adapter
2. **Connection Pool**: Uses `pg` driver's connection pool
3. **Lifecycle Hooks**: Connects on module init, disconnects on destroy
4. **Dependency Injection**: Available throughout the app via NestJS DI

### Using in Services

```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class BooksService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(userId: string) {
    return this.databaseService.book.findMany({
      where: { userId },
      include: { chapters: true }
    });
  }
}
```

## Troubleshooting

### Database Connection Issues

**Error**: `Can't reach database server`

**Solution**:
1. Make sure Docker PostgreSQL is running: `npm run db:start`
2. Check if the container is running: `docker ps | grep bookcast-postgres`
3. Verify the `DATABASE_URL` in `.env` is correct
4. Check database logs: `npm run db:logs`
5. Restart your NestJS application after starting the database

### Lost Data After Restart

**Problem**: Data disappeared after restarting the database

**Cause**: You likely ran `docker-compose down -v` or `npm run db:reset` which deletes the volume

**Solution**:
1. Run the seed script to restore baseline test data: `npm run db:seed`
2. Going forward, use `npm run db:stop`/`npm run db:start` or `npm run db:restart` to preserve data
3. Only use `npm run db:reset` when you intentionally want a fresh start

### Migration Conflicts

**Error**: `Migration failed` or schema drift detected

**Solution**:
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Or resolve manually
npx prisma migrate resolve --applied <migration_name>
```

### Prisma Client Out of Sync

**Error**: `Prisma Client does not match schema`

**Solution**:
```bash
npx prisma generate
```

### Type Errors After Schema Changes

**Solution**:
1. Regenerate Prisma Client: `npx prisma generate`
2. Restart TypeScript server in VSCode: `Ctrl+Shift+P` → "Restart TS Server"
3. Restart your NestJS application

### ECONNREFUSED Errors

**Error**: `PrismaClientKnownRequestError: ECONNREFUSED`

**Solution**:
1. The connection pool cached a failed connection
2. Restart your NestJS application
3. Make sure the database is running before starting the app

### Prisma Client Initialization Error

**Error**: `PrismaClient needs to be constructed with a non-empty, valid PrismaClientOptions`

**Cause**: Prisma v7 requires a PostgreSQL adapter

**Solution**:
Make sure your database service or scripts use the adapter pattern:
```typescript
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'bookcast',
  user: 'postgres',
  password: 'postgres',
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```

## Useful Commands Reference

### Database Management (NPM Scripts)
```bash
# Start PostgreSQL container
npm run db:start

# Stop PostgreSQL (keeps data)
npm run db:stop

# Restart PostgreSQL (keeps data)
npm run db:restart

# View database logs
npm run db:logs

# Seed database with test data
npm run db:seed

# Push schema changes
npm run db:push

# Open Prisma Studio GUI
npm run db:studio

# ⚠️ Reset database (deletes all data and reseeds)
npm run db:reset
```

### Docker Compose Commands
```bash
# Start database
docker-compose up -d

# Stop database (keeps data)
docker-compose stop

# Restart database
docker-compose restart

# View logs
docker-compose logs -f postgres

# Check running containers
docker ps | grep bookcast-postgres

# ⚠️ Remove volumes (deletes all data!)
docker-compose down -v
```

### Prisma Commands
```bash
# Push schema changes to database
npx prisma db push

# Generate Prisma Client
npx prisma generate

# Open Prisma Studio
npx prisma studio

# Seed database
npx ts-node prisma/seed.ts

# Format schema file
npx prisma format

# Validate schema
npx prisma validate
```

### Migrations (Production)
```bash
# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset
```

### Database Backup & Restore
```bash
# Backup database
docker exec bookcast-postgres pg_dump -U postgres bookcast > backup.sql

# Restore database
docker exec -i bookcast-postgres psql -U postgres bookcast < backup.sql

# Access PostgreSQL CLI
docker exec -it bookcast-postgres psql -U postgres -d bookcast
```

## Best Practices

1. **Always use migrations** - Don't use `db push` in production
2. **Test migrations** - Test on a copy of production data before deploying
3. **Use transactions** - For operations that must succeed or fail together
4. **Index frequently queried fields** - Add `@@index` to improve performance
5. **Use proper cascade rules** - Define `onDelete` behavior for relations
6. **Validate input data** - Use DTOs and class-validator before database operations
7. **Handle errors gracefully** - Catch Prisma errors and return meaningful messages
8. **Keep schema organized** - Use comments and consistent naming conventions

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma v7 Migration Guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrade-from-prisma-6-to-prisma-7)
- [NestJS + Prisma](https://docs.nestjs.com/recipes/prisma)
- [Prisma Schema Reference](https://www.prisma.io/docs/orm/reference/prisma-schema-reference)
