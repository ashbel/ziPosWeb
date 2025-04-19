import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logging.middleware';
import { setupRoutes } from './routes';
import { setupSocketHandlers } from './socket';
import { config } from './config';

export class AppServer {
  private app: express.Application;
  private server: http.Server;
  private io: Server;
  private prisma: PrismaClient;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: config.corsOrigins,
        methods: ['GET', 'POST']
      }
    });
    this.prisma = new PrismaClient();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: config.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });
    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Compression
    this.app.use(compression());

    // Logging
    this.app.use(requestLogger);

    // Make Prisma available in requests
    this.app.use((req, res, next) => {
      req.prisma = this.prisma;
      next();
    });
  }

  private setupRoutes(): void {
    setupRoutes(this.app);
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await this.prisma.$connect();

      // Setup WebSocket handlers
      setupSocketHandlers(this.io);

      // Start server
      this.server.listen(config.port, () => {
        console.log(`Server running on port ${config.port}`);
      });

      // Handle graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async shutdown(): Promise<void> {
    console.log('Shutting down server...');
    
    try {
      // Close database connection
      await this.prisma.$disconnect();

      // Close server
      this.server.close(() => {
        console.log('Server shut down successfully');
        process.exit(0);
      });

      // Force close after 5 seconds
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 5000);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start server
if (require.main === module) {
  const server = new AppServer();
  server.start();
} 