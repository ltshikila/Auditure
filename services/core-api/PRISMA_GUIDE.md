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

For local development, we use Prisma Dev which provides a local PostgreSQL instance:

```bash
# Start the Prisma Dev database
npx prisma dev

# The database will be available at:
# - HTTP: prisma+postgres://localhost:51213/
# - TCP: postgres://postgres:postgres@localhost:51214/template1
```

The `npx prisma dev` command:
- Starts a local PostgreSQL server
- Automatically applies migrations
- Runs in the background
- Persists data between restarts

### Managing the Development Database

```bash
# Start the database
npx prisma dev

# Stop the database (keeps data intact)
npx prisma dev stop default

# List all running Prisma Dev servers
npx prisma dev ls

# Remove/delete a server (WARNING: deletes all data!)
npx prisma dev rm default
```

**Important Notes**:
- Stopping the database shuts down PostgreSQL but preserves all data
- Removing a database server permanently deletes all data
- The server name is `default` unless you specified a different name with `-n` flag

### Environment Configuration

Your `.env` file should contain:

```env
DATABASE_URL="prisma+postgres://localhost:51213/?api_key=..."
```

The `DATABASE_URL` is automatically generated when you run `npx prisma dev`.

### Applying Migrations

```bash
# Apply all pending migrations to the database
npx prisma migrate deploy

# Create a new migration after schema changes
npx prisma migrate dev --name description_of_change

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Generating Prisma Client

After schema changes, regenerate the Prisma Client:

```bash
npx prisma generate
```

This is automatically done when you run migrations, but you can run it manually if needed.

### Using Prisma Studio

Prisma Studio provides a visual interface to view and edit your database. However, it doesn't support the `prisma+postgres://` protocol yet, so you need to use the TCP connection string:

```bash
# Start Prisma Studio with TCP connection
npx prisma studio --url "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable"
```

Prisma Studio will open in your browser at `http://localhost:51212` where you can:
- Browse all tables and records
- View relationships between models
- Add, edit, or delete data manually
- **View OTP codes** during development (found in the User table's `otpCode` field)
- Create test data quickly

**Note**: The TCP connection string uses port `51214` which is the database port, not the HTTP port `51213`.

## Development Workflow

### Making Schema Changes

1. **Edit the schema** in `prisma/schema.prisma`
2. **Create a migration**:
   ```bash
   npx prisma migrate dev --name add_new_field
   ```
3. **Prisma Client is auto-generated** during migration
4. **Restart your NestJS app** to pick up the changes

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
npx prisma migrate dev --name add_phone_number
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
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    super({ adapter });
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
1. Make sure Prisma Dev is running: `npx prisma dev`
2. Check that the `DATABASE_URL` in `.env` matches the output from `npx prisma dev`
3. Restart your NestJS application after starting the database

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

### Prisma Studio Protocol Error

**Error**: `The "prisma+postgres" protocol with localhost is not supported in Prisma Studio yet.`

**Solution**:
Use the TCP connection string instead:
```bash
npx prisma studio --url "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable"
```

This uses port `51214` (the TCP/PostgreSQL port) instead of `51213` (the HTTP port).

## Useful Commands Reference

### Database Management
```bash
# Start local database
npx prisma dev

# Stop database (keeps data)
npx prisma dev stop default

# List running databases
npx prisma dev ls

# Remove database (deletes all data!)
npx prisma dev rm default

# View database in browser (use TCP connection for Prisma Studio)
npx prisma studio --url "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable"
```

### Migrations
```bash
# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset

# Push schema without migration (dev only)
npx prisma db push
```

### Prisma Client
```bash
# Generate Prisma Client
npx prisma generate

# Format schema file
npx prisma format

# Validate schema
npx prisma validate
```

### Other
```bash
# Seed database (if seed script exists)
npx prisma db seed
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
