import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';

interface Migration {
  id: string;
  name: string;
  version: string;
  description: string;
  batch: number;
  executedAt: Date;
  duration: number;
  status: 'pending' | 'success' | 'failed';
  error?: string;
}

interface MigrationFile {
  name: string;
  version: string;
  description: string;
  up: (prisma: PrismaClient) => Promise<void>;
  down: (prisma: PrismaClient) => Promise<void>;
}

export class MigrationService extends BaseService {
  private readonly migrationsPath: string;
  private readonly lockKey: string = 'migration_lock';

  constructor(deps: any) {
    super(deps);
    
    this.migrationsPath = path.join(process.cwd(), 'migrations');
  }

  async runMigrations(
    options: {
      target?: string;
      dryRun?: boolean;
    } = {}
  ): Promise<Migration[]> {
    // Check lock
    if (await this.isLocked()) {
      throw new ValidationError('Migrations are already running');
    }

    try {
      await this.acquireLock();

      // Get pending migrations
      const pendingMigrations = await this.getPendingMigrations(options.target);
      if (pendingMigrations.length === 0) {
        return [];
      }

      // Get latest batch number
      const latestBatch = await this.getLatestBatchNumber();
      const batch = latestBatch + 1;

      const results: Migration[] = [];

      // Execute migrations
      for (const migration of pendingMigrations) {
        const startTime = Date.now();
        let status: Migration['status'] = 'pending';
        let error: string | undefined;

        try {
          if (!options.dryRun) {
            await this.prisma.$transaction(async (prisma) => {
              await migration.up(prisma);

              // Record migration
              await prisma.migration.create({
                data: {
                  name: migration.name,
                  version: migration.version,
                  description: migration.description,
                  batch,
                  executedAt: new Date(),
                  status: 'success'
                }
              });
            });
          }
          status = 'success';
        } catch (err) {
          status = 'failed';
          error = err.message;
          throw err;
        } finally {
          const duration = Date.now() - startTime;
          results.push({
            id: `${migration.version}_${migration.name}`,
            name: migration.name,
            version: migration.version,
            description: migration.description,
            batch,
            executedAt: new Date(),
            duration,
            status,
            error
          });
        }
      }

      return results;
    } finally {
      await this.releaseLock();
    }
  }

  async rollbackMigration(
    options: {
      batch?: number;
      steps?: number;
      dryRun?: boolean;
    } = {}
  ): Promise<Migration[]> {
    if (await this.isLocked()) {
      throw new ValidationError('Migrations are already running');
    }

    try {
      await this.acquireLock();

      // Get migrations to rollback
      const migrationsToRollback = await this.getMigrationsToRollback(options);
      if (migrationsToRollback.length === 0) {
        return [];
      }

      const results: Migration[] = [];

      // Execute rollbacks in reverse order
      for (const migration of migrationsToRollback.reverse()) {
        const startTime = Date.now();
        let status: Migration['status'] = 'pending';
        let error: string | undefined;

        try {
          if (!options.dryRun) {
            await this.prisma.$transaction(async (prisma) => {
              const migrationFile = await this.loadMigrationFile(migration.name);
              await migrationFile.down(prisma);

              // Remove migration record
              await prisma.migration.delete({
                where: { id: migration.id }
              });
            });
          }
          status = 'success';
        } catch (err) {
          status = 'failed';
          error = err.message;
          throw err;
        } finally {
          const duration = Date.now() - startTime;
          results.push({
            ...migration,
            duration,
            status,
            error
          });
        }
      }

      return results;
    } finally {
      await this.releaseLock();
    }
  }

  async getMigrationHistory(
    options: {
      limit?: number;
      offset?: number;
      status?: Migration['status'];
    } = {}
  ): Promise<Migration[]> {
    return this.prisma.migration.findMany({
      where: {
        status: options.status
      },
      orderBy: {
        executedAt: 'desc'
      },
      take: options.limit,
      skip: options.offset
    });
  }

  async createMigration(
    name: string,
    description: string
  ): Promise<string> {
    const version = this.generateVersion();
    const filename = `${version}_${name}.ts`;
    const filepath = path.join(this.migrationsPath, filename);

    const template = `
import { PrismaClient } from '@prisma/client';

export const version = '${version}';
export const name = '${name}';
export const description = '${description}';

export async function up(prisma: PrismaClient): Promise<void> {
  // Add your migration logic here
}

export async function down(prisma: PrismaClient): Promise<void> {
  // Add your rollback logic here
}
`;

    await fs.writeFile(filepath, template.trim());
    return filepath;
  }

  private async getPendingMigrations(
    targetVersion?: string
  ): Promise<MigrationFile[]> {
    // Get executed migrations
    const executed = await this.prisma.migration.findMany();
    const executedNames = new Set(executed.map(m => m.name));

    // Get all migration files
    const files = await fs.readdir(this.migrationsPath);
    const migrationFiles = await Promise.all(
      files
        .filter(f => f.endsWith('.ts'))
        .map(async f => {
          const file = await this.loadMigrationFile(f);
          return {
            ...file,
            pending: !executedNames.has(file.name)
          };
        })
    );

    // Filter pending migrations
    let pending = migrationFiles.filter(m => m.pending);

    // Filter by target version if specified
    if (targetVersion) {
      pending = pending.filter(m => m.version <= targetVersion);
    }

    // Sort by version
    return pending.sort((a, b) => a.version.localeCompare(b.version));
  }

  private async getMigrationsToRollback(
    options: {
      batch?: number;
      steps?: number;
    }
  ): Promise<Migration[]> {
    let query: any = {
      orderBy: {
        executedAt: 'desc'
      }
    };

    if (options.batch) {
      query.where = { batch: options.batch };
    }

    if (options.steps) {
      query.take = options.steps;
    } else {
      // Default to rolling back last batch
      const latestBatch = await this.getLatestBatchNumber();
      query.where = { batch: latestBatch };
    }

    return this.prisma.migration.findMany(query);
  }

  private async loadMigrationFile(filename: string): Promise<MigrationFile> {
    const filepath = path.join(this.migrationsPath, filename);
    const migration = require(filepath);

    if (!migration.up || !migration.down || !migration.version || !migration.name) {
      throw new ValidationError(`Invalid migration file: ${filename}`);
    }

    return migration;
  }

  private async getLatestBatchNumber(): Promise<number> {
    const latest = await this.prisma.migration.findFirst({
      orderBy: {
        batch: 'desc'
      }
    });

    return latest?.batch || 0;
  }

  private generateVersion(): string {
    return new Date().toISOString().replace(/\D/g, '');
  }

  private async isLocked(): Promise<boolean> {
    const lock = await this.prisma.migrationLock.findUnique({
      where: { key: this.lockKey }
    });

    return !!lock;
  }

  private async acquireLock(): Promise<void> {
    try {
      await this.prisma.migrationLock.create({
        data: {
          key: this.lockKey,
          acquiredAt: new Date()
        }
      });
    } catch (error) {
      throw new ValidationError('Failed to acquire migration lock');
    }
  }

  private async releaseLock(): Promise<void> {
    await this.prisma.migrationLock.delete({
      where: { key: this.lockKey }
    });
  }
} 