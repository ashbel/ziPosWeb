import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { compress } from 'zlib';

const execAsync = promisify(exec);
const pipelineAsync = promisify(pipeline);

export class SystemAdminService {
  constructor(private prisma: PrismaClient) {}

  async createBackup(type: 'FULL' | 'INCREMENTAL') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${type.toLowerCase()}-${timestamp}.gz`;

    try {
      // Create database dump
      const { stdout } = await execAsync(
        `pg_dump ${process.env.DATABASE_URL} --format=custom`
      );

      // Compress the dump
      await pipelineAsync(
        createReadStream(stdout),
        compress(),
        createWriteStream(`backups/${filename}`)
      );

      // Record backup in database
      await this.prisma.systemBackup.create({
        data: {
          type,
          filename,
          status: 'COMPLETED',
          size: (await fs.stat(`backups/${filename}`)).size
        }
      });

      return { success: true, filename };
    } catch (error) {
      await this.prisma.systemBackup.create({
        data: {
          type,
          filename,
          status: 'FAILED',
          error: error.message
        }
      });

      throw error;
    }
  }

  async monitorSystemHealth() {
    const metrics = {
      database: await this.checkDatabaseHealth(),
      api: await this.checkApiHealth(),
      storage: await this.checkStorageHealth(),
      performance: await this.checkSystemPerformance()
    };

    await this.prisma.systemMetrics.create({
      data: {
        timestamp: new Date(),
        metrics
      }
    });

    return metrics;
  }

  async manageSystemUpdates() {
    const pendingUpdates = await this.prisma.systemUpdate.findMany({
      where: {
        status: 'PENDING'
      },
      orderBy: {
        priority: 'desc'
      }
    });

    for (const update of pendingUpdates) {
      try {
        // Begin update process
        await this.prisma.systemUpdate.update({
          where: { id: update.id },
          data: { status: 'IN_PROGRESS' }
        });

        // Perform update
        await this.executeUpdate(update);

        // Mark as completed
        await this.prisma.systemUpdate.update({
          where: { id: update.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date()
          }
        });
      } catch (error) {
        await this.prisma.systemUpdate.update({
          where: { id: update.id },
          data: {
            status: 'FAILED',
            error: error.message
          }
        });
      }
    }
  }

  private async checkDatabaseHealth() {
    const metrics = await this.prisma.$queryRaw`
      SELECT 
        pg_database_size(current_database()) as db_size,
        (SELECT count(*) FROM pg_stat_activity) as connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_queries
    `;

    return metrics;
  }

  private async checkApiHealth() {
    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
    
    const metrics = await this.prisma.apiUsage.aggregate({
      where: {
        createdAt: { gte: last5Minutes }
      },
      _avg: {
        responseTime: true
      },
      _count: {
        id: true
      }
    });

    return {
      requestCount: metrics._count.id,
      averageResponseTime: metrics._avg.responseTime
    };
  }

  private async checkStorageHealth() {
    const { stdout } = await execAsync('df -h');
    return {
      diskUsage: stdout
    };
  }

  private async checkSystemPerformance() {
    const { stdout: memory } = await execAsync('free -m');
    const { stdout: cpu } = await execAsync('top -bn1 | grep "Cpu(s)"');
    
    return {
      memory,
      cpu
    };
  }

  private async executeUpdate(update: any) {
    // Implementation depends on update type
    switch (update.type) {
      case 'DATABASE_MIGRATION':
        await this.executeDatabaseMigration(update);
        break;
      case 'SYSTEM_PATCH':
        await this.applySystemPatch(update);
        break;
      case 'CONFIGURATION_UPDATE':
        await this.updateConfiguration(update);
        break;
      default:
        throw new Error(`Unknown update type: ${update.type}`);
    }
  }
} 