# Authentication Service

Complete authentication system with email verification, JWT tokens, and refresh token support.

## Features

- User registration with email verification
- OTP-based email verification
- JWT access tokens and refresh tokens
- Password hashing with bcrypt
- Protected routes with JWT guards
- OTP resend functionality

---

## Understanding the Architecture

### Why JWT over Sessions?

There are two main approaches to authentication. Understanding the trade-offs helps you make informed decisions.

```
SESSION-BASED                          TOKEN-BASED (JWT)
─────────────                          ─────────────────
User logs in                           User logs in
     │                                      │
     ▼                                      ▼
Server creates session                 Server creates JWT
Server stores in Redis/DB              Server sends to client
Server sends session ID cookie         Client stores token
     │                                      │
     ▼                                      ▼
Each request sends cookie              Each request sends token
Server looks up session                Server validates token signature
Server checks if valid                 Token contains all needed data
```

| Aspect | Sessions | JWT |
|--------|----------|-----|
| **Server memory** | Grows with active users | None (stateless) |
| **Horizontal scaling** | Requires shared session store (Redis) | Any server can validate |
| **Token revocation** | Easy - delete session from store | Hard - need blocklist or wait for expiry |
| **Token size** | Small (~32 bytes session ID) | Larger (~500+ bytes with claims) |
| **Database hits** | Every request checks session store | None (signature validation only) |

**We chose JWT because:**
1. We expect to scale horizontally (multiple API servers)
2. Stateless = simpler infrastructure (no session store to manage)
3. Mobile apps handle tokens better than cookies

**The trade-off:** We can't instantly revoke tokens. If a user's account is compromised, we can't "log them out" immediately. Hence:
- Short access token expiry (15 minutes)
- Refresh tokens for seamless re-authentication
- Refresh token rotation on each use

### Refresh Token Rotation

```
Initial Login:
  → Access Token (15 min) + Refresh Token A

After 15 minutes:
  → Client sends Refresh Token A
  → Server validates, issues new Access Token + Refresh Token B
  → Refresh Token A is now invalid

Why rotation?
  If Token A is stolen, attacker can only use it once.
  Next time legitimate user refreshes, Token A fails → we know it was compromised.
```

### Why Email Verification?

Email verification serves multiple purposes:
1. **Spam prevention**: Bots can't create thousands of accounts without valid emails
2. **Account recovery**: We can send password reset emails
3. **Communication**: We can notify users about their episodes
4. **Ownership proof**: User proves they own the email address

### Rate Limiting Considerations

The `/resend-otp` endpoint is vulnerable to abuse:
- Attacker could trigger thousands of emails to a victim
- Each email costs money (Resend charges per email)
- Could be used for email bombing harassment

**Current protection:** None in auth service (handled at API gateway level)

**Recommended:** Add rate limiting - max 3 OTP requests per email per hour

## API Endpoints

### Public Endpoints

#### Register a New User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201):**
```json
{
  "message": "Registration successful. Please check your email for the verification code.",
  "email": "user@example.com"
}
```

**Error Responses:**
- `409 Conflict` - Email already exists
- `400 Bad Request` - Invalid input data

---

#### Verify Email with OTP
```http
POST /auth/verify
Content-Type: application/json

{
  "email": "user@example.com",
  "otpCode": "123456"
}
```

**Response (201):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "message": "Email verified successfully"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired OTP
- `400 Bad Request` - OTP has expired

---

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (201) - Verified User:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

**Response (201) - Unverified User:**
```json
{
  "requiresVerification": true,
  "message": "Please verify your email. A new verification code has been sent.",
  "email": "user@example.com"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid credentials
- `400 Bad Request` - Invalid input data

---

#### Refresh Access Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (201):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired refresh token
- `400 Bad Request` - Missing refresh token

---

#### Resend OTP
```http
POST /auth/resend-otp
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response (201):**
```json
{
  "message": "Verification code sent successfully"
}
```

**Error Responses:**
- `401 Unauthorized` - User not found
- `400 Bad Request` - Email already verified or invalid email format

---

### Protected Endpoints

All protected endpoints require the `Authorization` header with a valid JWT token:

```http
Authorization: Bearer <access_token>
```

#### Get Current User Profile
```http
GET /auth/me
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "userId": "uuid",
  "email": "user@example.com"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token

## Architecture

### DTOs (Data Transfer Objects)

| DTO | Purpose | Validation |
|-----|---------|------------|
| `RegisterDto` | User registration | Email format, password strength, required fields |
| `LoginDto` | User login | Email format, password required |
| `VerifyDto` | Email verification | Email format, OTP code required |
| `RefreshTokenDto` | Token refresh | Refresh token required |
| `ResendOtpDto` | Resend verification code | Email format required |

### Services

#### AuthService
Core business logic for authentication:
- `register()` - Create new user with hashed password and send OTP
- `login()` - Authenticate user and return tokens
- `verify()` - Verify OTP and activate account
- `refreshToken()` - Generate new access/refresh token pair
- `resendOTP()` - Send new OTP to user email

### Guards

#### JwtAuthGuard
Protects routes requiring authentication. Validates JWT tokens and attaches user information to request object.

### Strategies

#### JwtStrategy
Passport strategy for JWT validation. Extracts and validates tokens from Authorization header.

## Error Handling

The service uses NestJS exception filters to return consistent error responses:

| Exception | HTTP Status | When Used |
|-----------|-------------|-----------|
| `ConflictException` | 409 | Email already exists |
| `UnauthorizedException` | 401 | Invalid credentials, expired tokens |
| `BadRequestException` | 400 | Invalid input, expired OTP |

## Testing

### Test Coverage

- **Unit Tests**: 17 tests covering all service methods
- **Integration Tests**: 15 tests covering all API endpoints
- **Coverage**: 98.7% statements, 90% branches, 100% functions

### Running Tests

```bash
# Run all auth tests
npm test -- auth

# Run with coverage
npm test -- auth --coverage

# Watch mode
npm test -- auth --watch
```

### Test Structure

```
src/auth/
├── auth.service.spec.ts        # Unit tests for AuthService
├── auth.controller.spec.ts     # Integration tests for API endpoints
└── __tests__/
    └── e2e/                     # End-to-end tests (optional)
```

### Example Test Cases

**Positive Tests:**
- Successful user registration
- Successful email verification
- Successful login with valid credentials
- Token refresh with valid refresh token

**Negative Tests:**
- Registration with existing email (409)
- Login with invalid credentials (401)
- Verification with wrong OTP (401)
- Verification with expired OTP (400)
- Token refresh with invalid token (401)
- Resend OTP to already verified email (400)

## Configuration

### Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_REFRESH_EXPIRES_IN=7d

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=noreply@auditure.app
EMAIL_PASSWORD=your-email-password
EMAIL_FROM=Auditure <noreply@auditure.app>

# OTP Configuration
OTP_EXPIRY_MINUTES=10
```

## Security Considerations

1. **Password Hashing**: Uses bcrypt with salt rounds for secure password storage
2. **JWT Tokens**:
   - Short-lived access tokens (15 minutes)
   - Long-lived refresh tokens (7 days)
   - Tokens stored securely on client side
3. **Email Verification**: Required before account activation
4. **OTP Expiry**: Time-limited verification codes (10 minutes)
5. **Rate Limiting**: Consider adding rate limiting for login/register endpoints
6. **HTTPS**: Always use HTTPS in production

## Dependencies

```json
{
  "@nestjs/jwt": "^11.0.2",
  "@nestjs/passport": "^11.0.5",
  "bcrypt": "^6.0.0",
  "passport": "^0.7.0",
  "passport-jwt": "^4.0.1",
  "class-validator": "^0.14.3",
  "class-transformer": "^0.5.1"
}
```

## Usage Example (Client Side)

```typescript
// Register
const registerResponse = await fetch('/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123!',
    firstName: 'John',
    lastName: 'Doe'
  })
});

// Verify
const verifyResponse = await fetch('/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    otpCode: '123456'
  })
});

const { accessToken, refreshToken } = await verifyResponse.json();

// Use access token
const profileResponse = await fetch('/auth/me', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

// Refresh token when expired
const refreshResponse = await fetch('/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken })
});
```

## Common Mistakes to Avoid

```typescript
// ❌ BAD: Comparing passwords directly
if (user.password === inputPassword) { ... }

// ✅ GOOD: Use bcrypt.compare (handles timing attacks)
if (await bcrypt.compare(inputPassword, user.password)) { ... }

// ❌ BAD: Storing JWT secret in code
const secret = 'my-secret-key';

// ✅ GOOD: Use environment variables
const secret = process.env.JWT_SECRET;

// ❌ BAD: Not validating token expiry
const decoded = jwt.decode(token); // decode doesn't verify!

// ✅ GOOD: Always use verify
const decoded = jwt.verify(token, secret); // throws if expired/invalid

// ❌ BAD: Sending password in response
return { user: { ...user } }; // Includes hashed password!

// ✅ GOOD: Exclude sensitive fields
const { password, ...safeUser } = user;
return { user: safeUser };

// ❌ BAD: Logging sensitive data
console.log('Login attempt:', { email, password });

// ✅ GOOD: Never log passwords
console.log('Login attempt:', { email });
```

## Future Enhancements

- [ ] OAuth integration (Google, Facebook, etc.)
- [ ] Two-factor authentication (2FA)
- [ ] Password reset functionality
- [ ] Account lockout after failed attempts
- [ ] Session management
- [ ] Email notification preferences
