import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.databaseUrl
    }
  },
  log: config.env === 'development' ? ['query', 'info', 'warn', 'error'] : ['error']
});

export default prisma; 