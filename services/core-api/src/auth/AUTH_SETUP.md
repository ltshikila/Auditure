# Auditure Authentication System

Complete JWT-based authentication with email 2FA implementation for both frontend (React Native) and backend (NestJS).

## Features

- ✅ User Registration with email verification
- ✅ Login with email and password
- ✅ Email 2FA with OTP (One-Time Password)
- ✅ JWT Access & Refresh Tokens
- ✅ Password Hashing with bcrypt
- ✅ Secure Token Storage (expo-secure-store)
- ✅ Protected Routes
- ✅ Auto Token Refresh
- ✅ OTP Resend Functionality
- ✅ PostgreSQL Database with Prisma ORM

## Tech Stack

### Backend
- NestJS 11
- Prisma ORM
- PostgreSQL (Prisma Postgres)
- JWT (@nestjs/jwt)
- Passport (@nestjs/passport)
- bcrypt (password hashing)
- Resend (email sending)

### Frontend
- React Native (Expo)
- Expo Router
- TypeScript
- Expo SecureStore (token storage)
- AsyncStorage (user data)

## Backend Setup

### 1. Install Dependencies

Already installed:
```bash
cd services/core-api
npm install
```

Dependencies include:
- @nestjs/jwt
- @nestjs/passport
- passport-jwt
- bcrypt
- resend
- @prisma/client
- prisma

### 2. Configure Environment Variables

Edit `services/core-api/.env`:

```env
# Database
DATABASE_URL="prisma+postgres://localhost:51213/?api_key=..."

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="your-super-secret-refresh-token-key-change-this-in-production"
JWT_REFRESH_EXPIRES_IN="7d"

# Email Configuration (Resend API)
EMAIL_FROM="Auditure <noreply@auditure.app>"
RESEND_API_KEY="re_xxxxxxxxxxxx"

# OTP Configuration
OTP_EXPIRY_MINUTES="10"
```

#### Setting up Resend for Email Sending

1. Create a free account at [resend.com](https://resend.com)
2. Add and verify your domain (e.g., auditure.app)
3. Create an API key in the dashboard
4. Copy the API key to `RESEND_API_KEY`

### 3. Database Setup

Start the Prisma Postgres database:

```bash
cd services/core-api
npx prisma dev
```

This will:
- Start a local PostgreSQL instance
- Keep it running in the background

Run migrations:

```bash
npx prisma migrate dev
```

Generate Prisma Client:

```bash
npx prisma generate
```

### 4. Start the Backend Server

```bash
npm run start:dev
```

Server runs on `http://localhost:3000`

## Frontend Setup

### 1. Configure API URL

Edit `apps/mobile-app/.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```

**Important for mobile testing:**
- If testing on a physical device, use your computer's local IP address
- Find your IP:
  - Windows: `ipconfig` (look for IPv4 Address)
  - Mac/Linux: `ifconfig` or `ip addr`
- Example: `EXPO_PUBLIC_API_URL=http://192.168.1.100:3000`

### 2. Start the Mobile App

```bash
cd apps/mobile-app
npm start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go for physical device

## API Endpoints

### Authentication Endpoints

#### Register
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-01-01"  // Optional
}

Response:
{
  "message": "Registration successful. Please check your email for the verification code.",
  "email": "user@example.com"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response (Unverified):
{
  "requiresVerification": true,
  "message": "Please verify your email. A new verification code has been sent.",
  "email": "user@example.com"
}

Response (Verified):
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

#### Verify Email
```http
POST /auth/verify
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}

Response:
{
  "message": "Email verified successfully",
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

#### Resend OTP
```http
POST /auth/resend-otp
Content-Type: application/json

{
  "email": "user@example.com"
}

Response:
{
  "message": "Verification code sent successfully"
}
```

#### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Get Profile (Protected)
```http
GET /auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Response:
{
  "userId": "uuid",
  "email": "user@example.com"
}
```

## Authentication Flow

### Registration Flow

1. User fills registration form
2. Frontend sends POST to `/auth/register`
3. Backend:
   - Validates input
   - Hashes password with bcrypt
   - Creates user in database
   - Generates 6-digit OTP
   - Sends OTP via email
   - Returns success message
4. User is redirected to verification screen

### Login Flow

1. User enters email and password
2. Frontend sends POST to `/auth/login`
3. Backend:
   - Finds user by email
   - Validates password with bcrypt
   - If not verified:
     - Generates new OTP
     - Sends email
     - Returns `requiresVerification: true`
   - If verified:
     - Generates JWT tokens
     - Saves refresh token to database
     - Returns tokens and user data
4. Frontend:
   - If requires verification: redirects to verification screen
   - If verified: saves tokens and redirects to home

### Verification Flow

1. User enters 6-digit code from email
2. Frontend sends POST to `/auth/verify`
3. Backend:
   - Validates OTP
   - Checks expiry (10 minutes)
   - Marks email as verified
   - Generates JWT tokens
   - Returns tokens and user data
4. Frontend saves tokens and redirects to home

### Protected Routes

1. User tries to access protected route
2. Frontend checks if authenticated
3. If not: redirects to login
4. If yes: includes access token in Authorization header
5. Backend JWT strategy validates token
6. If valid: allows access
7. If expired: frontend uses refresh token to get new access token

## File Structure

### Backend

```
services/core-api/
├── prisma/
│   ├── schema.prisma              # Database schema
│   └── migrations/                # Database migrations
├── src/
│   ├── auth/
│   │   ├── dto/
│   │   │   ├── register.dto.ts    # Registration validation
│   │   │   ├── login.dto.ts       # Login validation
│   │   │   └── verify.dto.ts      # Verification validation
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts  # JWT guard
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts    # JWT strategy
│   │   ├── auth.controller.ts     # Auth endpoints
│   │   ├── auth.service.ts        # Auth logic
│   │   └── auth.module.ts         # Auth module
│   ├── common/
│   │   ├── email.service.ts       # Email sending
│   │   └── common.module.ts
│   ├── database/
│   │   ├── database.service.ts    # Prisma client
│   │   └── database.module.ts
│   ├── app.module.ts
│   └── main.ts                    # CORS & validation setup
└── .env                           # Environment variables
```

### Frontend

```
apps/mobile-app/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── Auth.tsx           # Login/Register screen
│   │   │   ├── Verification.tsx   # OTP verification
│   │   │   └── _layout.tsx
│   │   ├── (tabs)/
│   │   │   └── _layout.tsx        # Protected tabs
│   │   ├── index.tsx              # Root redirect
│   │   └── _layout.tsx            # AuthProvider wrapper
│   ├── contexts/
│   │   └── AuthContext.tsx        # Auth state management
│   ├── services/
│   │   ├── api.ts                 # API client
│   │   ├── auth.service.ts        # Auth API calls
│   │   └── storage.service.ts     # Token storage
│   └── components/
│       └── AuthInput.tsx          # Input component
└── .env                           # API URL
```

## Security Features

### Password Security
- Passwords hashed with bcrypt (10 rounds)
- Never stored in plain text
- Minimum 6 characters enforced

### JWT Security
- Short-lived access tokens (15 minutes)
- Long-lived refresh tokens (7 days)
- Tokens signed with secret keys
- Refresh tokens stored in database
- Token validation on every protected request

### OTP Security
- 6-digit random codes
- 10-minute expiry
- One-time use
- New OTP invalidates previous

### Storage Security
- Access/refresh tokens in expo-secure-store (encrypted)
- User data in AsyncStorage (not sensitive)
- Tokens never logged or exposed

### API Security
- CORS enabled for specific origins
- Input validation with class-validator
- Password confirmation on registration
- Email verification required before access
- Protected routes require valid JWT

## Testing the Flow

### 1. Register a New User

1. Open the app
2. Tap "Sign Up"
3. Fill in:
   - First Name: John
   - Last Name: Doe
   - Email: test@example.com
   - Date of Birth: 1990-01-01
   - Password: password123
   - Confirm Password: password123
4. Tap "Register"
5. Check email for 6-digit code

### 2. Verify Email

1. Enter the 6-digit code from email
2. Tap "Verify"
3. You'll be redirected to the home screen
4. You're now authenticated!

### 3. Test Protected Routes

1. Try navigating to different tabs
2. All should work since you're authenticated
3. Close and reopen the app
4. You should remain logged in (token persistence)

### 4. Test Login

1. Logout (you'll need to implement this in your UI)
2. Go to login screen
3. Enter email and password
4. Since email is verified, you'll be logged in directly

## Troubleshooting

### Email Not Sending

- Verify RESEND_API_KEY is correct
- Ensure domain is verified in Resend dashboard
- Check EMAIL_FROM matches your verified domain
- Check backend console for email errors

### Database Connection Error

- Ensure Prisma Postgres is running: `npx prisma dev`
- Check DATABASE_URL in .env
- Run migrations: `npx prisma migrate dev`

### Mobile App Can't Connect to Backend

- Use local IP instead of localhost for physical devices
- Ensure backend is running on port 3000
- Check EXPO_PUBLIC_API_URL in mobile .env
- Ensure both devices on same network

### JWT Token Invalid

- Check JWT_SECRET matches in backend .env
- Ensure tokens aren't expired
- Try refreshing token
- Clear app storage and re-login

## Next Steps

### Recommended Enhancements

1. **Password Reset Flow**
   - Forgot password endpoint
   - Email with reset link
   - Reset password form

2. **Social Login**
   - Google OAuth
   - Apple Sign In
   - Facebook Login

3. **User Profile Management**
   - Update profile endpoint
   - Change password
   - Delete account

4. **Enhanced Security**
   - Rate limiting
   - Account lockout after failed attempts
   - IP-based blocking
   - Device fingerprinting

5. **Notifications**
   - Login alerts
   - New device notifications
   - Security warnings

## Environment Variables Reference

### Backend (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| DATABASE_URL | Prisma Postgres connection string | `prisma+postgres://localhost:51213/?api_key=...` |
| JWT_SECRET | Secret for signing access tokens | `your-secret-key` |
| JWT_EXPIRES_IN | Access token expiry | `15m` |
| JWT_REFRESH_SECRET | Secret for refresh tokens | `your-refresh-secret` |
| JWT_REFRESH_EXPIRES_IN | Refresh token expiry | `7d` |
| EMAIL_FROM | From header | `Auditure <noreply@auditure.app>` |
| RESEND_API_KEY | Resend API key | `re_xxxxxxxxxxxx` |
| OTP_EXPIRY_MINUTES | OTP validity duration | `10` |

### Frontend (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| EXPO_PUBLIC_API_URL | Backend API base URL | `http://192.168.1.100:3000` |

## Support

For issues or questions:
1. Check this documentation
2. Review backend logs: `npm run start:dev`
3. Check Prisma Studio: `npx prisma studio`
4. Inspect network requests in app
