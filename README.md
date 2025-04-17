# POS System

A modern Point of Sale (POS) system built with Next.js, TypeScript, and Prisma.

## System Functionality

### Core Features
- **User Management**
  - Multi-role system (Admin, Manager, Staff, Cashier)
  - User authentication and authorization
  - Session management and security
  - Permission-based access control

- **Product Management**
  - Product catalog with categories
  - Inventory tracking and management
  - Low stock alerts and reorder points
  - Barcode and SKU management

- **Order Processing**
  - Real-time order creation and management
  - Multiple payment methods (Cash, Credit Card, Debit Card, Mobile Payment)
  - Tax calculation and management
  - Discount and promotion handling
  - Receipt generation

- **Cash Management**
  - Shift management for cashiers
  - Cash drawer tracking
  - Opening and closing balances
  - Transaction history and reconciliation

- **Reporting and Analytics**
  - Sales reports and analytics
  - Inventory reports
  - Financial reports
  - Custom report generation
  - Export capabilities

### Advanced Features
- **Integration Capabilities**
  - Third-party service integration
  - Webhook support
  - API key management
  - External system synchronization

- **Security Features**
  - JWT-based authentication
  - Rate limiting
  - Password policies
  - Multi-factor authentication
  - Audit logging

- **Forecasting and Planning**
  - Sales forecasting
  - Inventory demand prediction
  - Seasonal trend analysis
  - Performance metrics

- **Multi-location Support**
  - Store management
  - Cross-store inventory
  - Centralized reporting
  - Location-specific settings

- **Customer Management**
  - Customer profiles
  - Purchase history
  - Loyalty programs
  - Customer communication

### System Requirements
- Real-time processing capabilities
- High availability and reliability
- Scalable architecture
- Secure data handling
- Audit trail maintenance
- Multi-user support
- Offline operation capability
- Backup and recovery options

## Tech Stack

### Frontend
- **Framework**: Next.js 14
- **Language**: TypeScript
- **UI Library**: React
- **State Management**: React Query
- **Styling**: Tailwind CSS
- **Form Handling**: React Hook Form
- **Validation**: Zod
- **Testing**: Jest, React Testing Library

### Backend
- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Caching**: Redis
- **Authentication**: JWT
- **Validation**: Zod
- **Logging**: Winston
- **Testing**: Jest, Supertest

## Project Structure

```
pos-system/
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/             # Next.js app router
│   │   ├── components/      # Reusable UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility functions
│   │   ├── services/       # API service functions
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Helper functions
│   ├── public/             # Static assets
│   ├── tests/              # Frontend tests
│   └── package.json
│
├── backend/                 # Express.js backend application
│   ├── src/
│   │   ├── controllers/    # Route controllers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Helper functions
│   ├── prisma/             # Prisma configuration
│   ├── tests/              # Backend tests
│   └── package.json
│
└── README.md
```

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v15 or higher)
- Redis (v7 or higher)
- npm or yarn

## Environment Setup

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Update the `.env` file with your configuration:
   ```env
   # Database
   DATABASE_URL="postgresql://postgres:root@localhost:5432/pos_system?schema=public"

   # Redis
   REDIS_URL="redis://localhost:6379"

   # JWT
   JWT_SECRET="your-secret-key"
   JWT_EXPIRES_IN="7d"

   # Server
   PORT=3000
   NODE_ENV="development"

   # Logging
   LOG_LEVEL="info"

   # Security
   PASSWORD_SALT_ROUNDS=10
   RATE_LIMIT_WINDOW=15
   RATE_LIMIT_MAX=100
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Update the `.env` file with your configuration:
   ```env
   # API
   NEXT_PUBLIC_API_URL="http://localhost:3000"
   NEXT_PUBLIC_API_TIMEOUT=10000

   # Authentication
   NEXT_PUBLIC_JWT_EXPIRES_IN="7d"

   # Feature Flags
   NEXT_PUBLIC_ENABLE_ANALYTICS=true
   NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true

   # UI
   NEXT_PUBLIC_THEME="light"
   NEXT_PUBLIC_DEFAULT_LOCALE="en"

   # Development
   NODE_ENV="development"
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## Development Workflow

1. Create a new branch for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit them:
   ```bash
   git add .
   git commit -m "feat: add your feature"
   ```

3. Push your changes:
   ```bash
   git push origin feature/your-feature-name
   ```

4. Create a pull request on GitHub.

## Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

## Database Management

### Prisma Commands
- Generate Prisma Client:
  ```bash
  npx prisma generate
  ```

- Create a new migration:
  ```bash
  npx prisma migrate dev --name your-migration-name
  ```

- Reset the database:
  ```bash
  npx prisma migrate reset
  ```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 