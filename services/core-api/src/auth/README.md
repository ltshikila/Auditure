# Authentication Service

Complete authentication system with email verification, JWT tokens, and refresh token support.

## Features

- ✅ User registration with email verification
- ✅ OTP-based email verification
- ✅ JWT access tokens and refresh tokens
- ✅ Password hashing with bcrypt
- ✅ Protected routes with JWT guards
- ✅ OTP resend functionality

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
- ✅ Successful user registration
- ✅ Successful email verification
- ✅ Successful login with valid credentials
- ✅ Token refresh with valid refresh token

**Negative Tests:**
- ✅ Registration with existing email (409)
- ✅ Login with invalid credentials (401)
- ✅ Verification with wrong OTP (401)
- ✅ Verification with expired OTP (400)
- ✅ Token refresh with invalid token (401)
- ✅ Resend OTP to already verified email (400)

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
EMAIL_USER=noreply@bookcast.com
EMAIL_PASSWORD=your-email-password
EMAIL_FROM=BookCast <noreply@bookcast.com>

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

## Future Enhancements

- [ ] OAuth integration (Google, Facebook, etc.)
- [ ] Two-factor authentication (2FA)
- [ ] Password reset functionality
- [ ] Account lockout after failed attempts
- [ ] Session management
- [ ] Email notification preferences
