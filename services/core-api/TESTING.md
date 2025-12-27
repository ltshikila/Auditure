# Testing Guide

Comprehensive testing documentation for the BookCast Core API.

## Overview

The Core API uses a multi-layered testing strategy with unit tests, integration tests, and extensive negative testing to ensure robust error handling.

## Test Statistics

| Metric | Value |
|--------|-------|
| **Total Tests** | 83 passing, 1 skipped |
| **Test Suites** | 5 suites |
| **Overall Coverage** | Auth: 90%+, Books: 93%+ |
| **Test Execution Time** | ~4 seconds |

## Testing Stack

- **Test Framework**: Jest
- **Assertion Library**: Jest built-in
- **HTTP Testing**: Supertest
- **Mocking**: Jest mocks + custom mock factories
- **Test Environment**: Node (isolated)

## Test Structure

```
services/core-api/
├── src/
│   ├── auth/
│   │   ├── auth.service.spec.ts           # Unit tests
│   │   └── auth.controller.spec.ts        # Integration tests
│   └── books/
│       ├── books.service.spec.ts          # Unit tests
│       └── books.controller.spec.ts       # Integration tests
├── test/
│   ├── setup.ts                           # Global test configuration
│   ├── mocks/
│   │   ├── database.mock.ts               # Prisma mocks
│   │   └── services.mock.ts               # Service mocks
│   └── fixtures/
│       ├── users.fixture.ts               # Test data factories
│       └── books.fixture.ts               # Test data factories
└── .env.test                              # Test environment variables
```

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Suite
```bash
# Auth tests only
npm test -- auth

# Books tests only
npm test -- books

# Single file
npm test -- auth.service.spec.ts
```

### With Coverage
```bash
npm test -- --coverage

# Specific module with coverage
npm test -- auth --coverage
```

### Watch Mode
```bash
npm test -- --watch

# Watch specific files
npm test -- --watch auth
```

### Debug Mode
```bash
npm test -- --runInBand --detectOpenHandles
```

## Test Configuration

### Jest Configuration (package.json)

```json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

### Test Environment (.env.test)

```env
NODE_ENV=test
DATABASE_URL="prisma+postgres://localhost:51213/?api_key=test"

JWT_SECRET="test-secret-key"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="test-refresh-secret-key"
JWT_REFRESH_EXPIRES_IN="7d"

EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_USER="test@example.com"
EMAIL_PASSWORD="test-password"
EMAIL_FROM="BookCast <noreply@bookcast.com>"

OTP_EXPIRY_MINUTES="10"

STORAGE_BACKEND="local"
LOCAL_STORAGE_PATH="./test-storage"

RABBITMQ_URL="amqp://localhost:5672"
```

### Global Setup (test/setup.ts)

```typescript
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};
```

## Test Types

### Unit Tests

Test individual service methods in isolation with mocked dependencies.

**Example: Auth Service Unit Test**

```typescript
describe('AuthService', () => {
  let service: AuthService;
  let databaseService: DatabaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DatabaseService, useValue: mockPrismaClient },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService }
      ]
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should register a new user successfully', async () => {
    mockPrismaClient.user.findUnique.mockResolvedValue(null);
    mockPrismaClient.user.create.mockResolvedValue(mockUser);

    const result = await service.register(mockRegisterDto);

    expect(result.email).toBe(mockUser.email);
    expect(emailService.sendOTP).toHaveBeenCalled();
  });
});
```

**Coverage:**
- Auth Service: 17 tests, 98.7% coverage
- Books Service: 31 tests, 100% coverage

### Integration Tests

Test API endpoints with full request/response cycle using supertest.

**Example: Books Controller Integration Test**

```typescript
describe('BooksController (Integration)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [{ provide: BooksService, useValue: mockBooksService }]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true
    }));
    await app.init();
  });

  it('should upload a book successfully', () => {
    return request(app.getHttpServer())
      .post('/books/upload')
      .set('Authorization', 'Bearer mock-token')
      .attach('file', Buffer.from('mock pdf'), 'test.pdf')
      .field('title', 'Test Book')
      .field('sourceType', 'PDF')
      .expect(201);
  });
});
```

**Coverage:**
- Auth Controller: 15 tests
- Books Controller: 14 tests

## Testing Patterns

### 1. Mocking External Dependencies

**Database Mocking:**
```typescript
export const mockPrismaClient = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  book: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};
```

**Service Mocking:**
```typescript
export const mockEmailService = {
  sendOTP: jest.fn().mockResolvedValue(undefined),
};

export const mockStorageService = {
  uploadFile: jest.fn().mockResolvedValue('mock-storage-key'),
  downloadFile: jest.fn().mockResolvedValue(Buffer.from('content')),
};
```

### 2. Test Fixtures

**User Fixture:**
```typescript
export const createMockUser = (overrides = {}) => ({
  id: randomUUID(),
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  password: 'hashed-password',
  isEmailVerified: false,
  otpCode: '123456',
  otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
  ...overrides
});
```

**Book Fixture:**
```typescript
export const createMockBook = (overrides = {}) => ({
  id: randomUUID(),
  userId: randomUUID(),
  title: 'Test Book',
  author: 'Test Author',
  sourceType: 'PDF',
  extractionStatus: 'PENDING',
  fileStorageKey: 'books/test.pdf',
  ...overrides
});
```

### 3. Bcrypt Mocking

Bcrypt requires special module-level mocking:

```typescript
jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('mock-salt'),
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));
```

Then use in tests:
```typescript
it('should hash password', async () => {
  const bcrypt = require('bcrypt');
  await service.register(dto);
  expect(bcrypt.hash).toHaveBeenCalledWith(password, 'mock-salt');
});
```

### 4. Supertest Import Pattern

Use CommonJS require for supertest compatibility:

```typescript
import request = require('supertest');
```

## Negative Testing Strategy

Every service method has corresponding negative test cases:

### Auth Service Negative Tests

```typescript
// ConflictException
it('should throw ConflictException if email exists', async () => {
  mockPrismaClient.user.findUnique.mockResolvedValue(existingUser);
  await expect(service.register(dto)).rejects.toThrow(ConflictException);
});

// UnauthorizedException
it('should throw UnauthorizedException for wrong password', async () => {
  bcrypt.compare.mockResolvedValue(false);
  await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
});

// BadRequestException
it('should throw BadRequestException for expired OTP', async () => {
  const expiredUser = createMockUser({ otpExpiry: new Date(Date.now() - 1000) });
  await expect(service.verify(dto)).rejects.toThrow(BadRequestException);
});
```

### Books Service Negative Tests

```typescript
// NotFoundException
it('should throw NotFoundException if book does not exist', async () => {
  mockPrismaClient.book.findUnique.mockResolvedValue(null);
  await expect(service.findOne(userId, bookId)).rejects.toThrow(NotFoundException);
});

// ForbiddenException
it('should throw ForbiddenException if user is not owner', async () => {
  const otherUserBook = createMockBook({ userId: 'different-user' });
  await expect(service.findOne(userId, bookId)).rejects.toThrow(ForbiddenException);
});

// Service Failures
it('should handle storage upload failure gracefully', async () => {
  mockStorageService.uploadFile.mockRejectedValue(new Error('Storage unavailable'));
  await expect(service.uploadBook(...)).rejects.toThrow('Storage unavailable');
});
```

### Controller Negative Tests

```typescript
// Validation Errors
it('should return 400 for missing required fields', () => {
  return request(app.getHttpServer())
    .post('/auth/register')
    .send({})
    .expect(400);
});

// Not Found
it('should return 404 for non-existent resource', () => {
  mockService.findOne.mockRejectedValue(new NotFoundException());
  return request(app.getHttpServer())
    .get('/books/non-existent-id')
    .expect(404);
});

// Forbidden
it('should return 403 for unauthorized access', () => {
  mockService.findOne.mockRejectedValue(new ForbiddenException());
  return request(app.getHttpServer())
    .get('/books/other-user-book')
    .expect(403);
});
```

## Test Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| **Statements** | > 90% | 94%+ |
| **Branches** | > 80% | 85%+ |
| **Functions** | > 95% | 100% |
| **Lines** | > 90% | 94%+ |

### Viewing Coverage Reports

```bash
# Generate coverage report
npm test -- --coverage

# Coverage report location
coverage/
├── lcov-report/
│   └── index.html          # Open in browser
└── coverage-final.json     # Raw coverage data
```

## Common Testing Issues & Solutions

### Issue 1: "File has not been read yet"
**Cause**: Trying to edit a file without reading it first in the same test
**Solution**: Use `Read` tool before `Edit`, or read file in `beforeEach`

### Issue 2: Bcrypt mocking errors
**Cause**: Using `jest.spyOn()` on bcrypt module
**Solution**: Use `jest.mock()` at module level before describe block

### Issue 3: Supertest "request is not a function"
**Cause**: ES6 import incompatibility
**Solution**: Use `import request = require('supertest')`

### Issue 4: Validation not working in tests
**Cause**: Missing `ValidationPipe` in test app setup
**Solution**: Add `app.useGlobalPipes(new ValidationPipe({...}))`

### Issue 5: Async test timeouts
**Cause**: Missing await, unresolved promises
**Solution**: Ensure all async operations use await, check for hanging promises

## Best Practices

### 1. Test Isolation
```typescript
beforeEach(() => {
  jest.clearAllMocks(); // Clear mock calls before each test
});

afterEach(async () => {
  await app.close(); // Close app after integration tests
});
```

### 2. Descriptive Test Names
```typescript
// Good
it('should throw UnauthorizedException when password is incorrect', ...)

// Bad
it('should fail login', ...)
```

### 3. Arrange-Act-Assert Pattern
```typescript
it('should register user', async () => {
  // Arrange
  mockPrismaClient.user.findUnique.mockResolvedValue(null);
  mockPrismaClient.user.create.mockResolvedValue(mockUser);

  // Act
  const result = await service.register(dto);

  // Assert
  expect(result.email).toBe(mockUser.email);
  expect(emailService.sendOTP).toHaveBeenCalled();
});
```

### 4. Test Data Factories
Use fixtures for consistent test data:
```typescript
// Instead of inline objects
const mockUser = createMockUser({ email: 'custom@example.com' });
```

### 5. Mock Reset Between Tests
```typescript
beforeEach(() => {
  jest.clearAllMocks();
  mockStorageService.uploadFile.mockResolvedValue('default-key');
});
```

## Continuous Integration

### GitHub Actions Example
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v2
        with:
          files: ./coverage/lcov.info
```

## Future Testing Enhancements

- [ ] E2E tests with real database (TestContainers)
- [ ] Performance/load testing (Artillery, k6)
- [ ] Contract testing for microservices (Pact)
- [ ] Mutation testing (Stryker)
- [ ] Visual regression testing (Percy, Chromatic)
- [ ] API documentation testing (Dredd)
- [ ] Security testing (OWASP ZAP)

## Troubleshooting

### Tests are slow
- Use `--maxWorkers=50%` to limit parallel execution
- Mock heavy operations (file I/O, network calls)
- Use in-memory database for integration tests

### Flaky tests
- Add explicit waits for async operations
- Avoid relying on timing (setTimeout)
- Ensure proper cleanup in afterEach
- Check for shared state between tests

### Coverage gaps
- Run `npm test -- --coverage` to identify uncovered lines
- Add tests for error paths and edge cases
- Test boundary conditions
- Add negative test cases

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## Contributing

When adding new features:
1. Write unit tests first (TDD)
2. Add integration tests for API endpoints
3. Include negative test cases
4. Aim for >90% coverage
5. Update this documentation
6. Run full test suite before PR
