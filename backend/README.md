# POS System Backend System

A backend service for a Point of Sale (POS) system with authentication, authorization, and 2FA support.

## Features

- User authentication (login/register)
- JWT-based authorization
- Two-factor authentication (2FA)
- Role-based access control
- OAuth support (Google, GitHub, Facebook)
- Database integration with Prisma
- TypeScript support

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- npm or yarn

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/pos_system"
   JWT_SECRET="your-secret-key-here"
   ```

4. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```

5. Run database migrations:
   ```bash
   npm run prisma:migrate
   ```

## Development

Start the development server:
```bash
npm run dev
```

## Production

Build the application:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh-token` - Refresh JWT token
- `POST /api/auth/setup-2fa` - Setup 2FA (protected)
- `POST /api/auth/verify-2fa` - Verify 2FA code (protected)
- `POST /api/auth/enable-2fa` - Enable 2FA (protected)
- `POST /api/auth/disable-2fa` - Disable 2FA (protected)

### OAuth (To be implemented)

- `GET /api/auth/google` - Google OAuth
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/github` - GitHub OAuth
- `GET /api/auth/github/callback` - GitHub OAuth callback
- `GET /api/auth/facebook` - Facebook OAuth
- `GET /api/auth/facebook/callback` - Facebook OAuth callback

## Testing

Run tests:
```bash
npm test
```

## License

MIT 