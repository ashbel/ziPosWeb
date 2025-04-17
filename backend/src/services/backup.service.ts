import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, readdir, unlink } from 'fs/promises';
import { join, basename } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import archiver from 'archiver';
import { S3 } from 'aws-sdk';
import { parse as parseDate } from 'date-fns';

const execAsync = promisify(exec);

interface BackupConfig {
  storage: 'local' | 's3';
  retention: {
    days: number;
    maxBackups: number;
  };
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string; // HH:mm format
    day?: number; // Day of week (0-6) or day of month (1-31)
  };
  includeFiles: boolean;
  compress: boolean;
  encrypt: boolean;
}

interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental';
  size: number;
  status: 'completed' | 'failed';
  error?: string;
  location: string;
  checksum: string;
}

export class BackupService extends BaseService {
  private s3: S3;
  private backupPath: string;
  private encryptionKey: string;

  constructor(deps: any) {
    super(deps);
    
    this.backupPath = process.env.BACKUP_PATH || './backups';
    this.encryptionKey = process.env.BACKUP_ENCRYPTION_KEY || '';

    // Initialize S3 client
    this.s3 = new S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });

    this.initializeBackupDirectory();
  }

  async createBackup(type: 'full' | 'incremental' = 'full'): Promise<BackupMetadata> {
    const config = await this.getBackupConfig();
    const timestamp = new Date();
    const backupId = `backup_${timestamp.getTime()}`;

    try {
      // Create backup directory
      const backupDir = join(this.backupPath, backupId);
      await mkdir(backupDir, { recursive: true });

      // Backup database
      const dbBackupPath = join(backupDir, 'database.sql');
      await this.backupDatabase(dbBackupPath);

      // Backup files if configured
      if (config.includeFiles) {
        await this.backupFiles(backupDir);
      }

      // Compress backup if configured
      const archivePath = config.compress
        ? await this.compressBackup(backupDir, backupId)
        : backupDir;

      // Encrypt backup if configured
      const finalPath = config.encrypt
        ? await this.encryptBackup(archivePath)
        : archivePath;

      // Calculate checksum
      const checksum = await this.calculateChecksum(finalPath);

      // Upload to S3 if configured
      const location = config.storage === 's3'
        ? await this.uploadToS3(finalPath, backupId)
        : finalPath;

      // Create backup metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp,
        type,
        size: await this.getFileSize(finalPath),
        status: 'completed',
        location,
        checksum
      };

      // Save backup metadata
      await this.saveBackupMetadata(metadata);

      // Clean up old backups
      await this.cleanupOldBackups(config);

      return metadata;
    } catch (error) {
      // Log backup failure
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp,
        type,
        size: 0,
        status: 'failed',
        error: error.message,
        location: '',
        checksum: ''
      };

      await this.saveBackupMetadata(metadata);
      throw error;
    }
  }

  async restoreBackup(backupId: string): Promise<void> {
    const metadata = await this.getBackupMetadata(backupId);
    if (!metadata) {
      throw new ValidationError(`Backup ${backupId} not found`);
    }

    const config = await this.getBackupConfig();
    let backupPath = metadata.location;

    try {
      // Download from S3 if necessary
      if (config.storage === 's3') {
        backupPath = await this.downloadFromS3(metadata.location);
      }

      // Decrypt if encrypted
      if (config.encrypt) {
        backupPath = await this.decryptBackup(backupPath);
      }

      // Decompress if compressed
      if (config.compress) {
        backupPath = await this.decompressBackup(backupPath);
      }

      // Restore database
      await this.restoreDatabase(join(backupPath, 'database.sql'));

      // Restore files if included
      if (config.includeFiles) {
        await this.restoreFiles(backupPath);
      }

      // Log successful restore
      await this.prisma.backupLog.create({
        data: {
          backupId,
          action: 'restore',
          status: 'completed'
        }
      });
    } catch (error) {
      // Log restore failure
      await this.prisma.backupLog.create({
        data: {
          backupId,
          action: 'restore',
          status: 'failed',
          error: error.message
        }
      });
      throw error;
    }
  }

  async getBackups(): Promise<BackupMetadata[]> {
    return this.prisma.backupMetadata.findMany({
      orderBy: { timestamp: 'desc' }
    });
  }

  async verifyBackup(backupId: string): Promise<boolean> {
    const metadata = await this.getBackupMetadata(backupId);
    if (!metadata) {
      throw new ValidationError(`Backup ${backupId} not found`);
    }

    const config = await this.getBackupConfig();
    let backupPath = metadata.location;

    // Download from S3 if necessary
    if (config.storage === 's3') {
      backupPath = await this.downloadFromS3(metadata.location);
    }

    // Calculate checksum
    const checksum = await this.calculateChecksum(backupPath);

    return checksum === metadata.checksum;
  }

  private async initializeBackupDirectory() {
    await mkdir(this.backupPath, { recursive: true });
  }

  private async backupDatabase(outputPath: string): Promise<void> {
    const { host, port, database, user, password } = this.getDatabaseConfig();

    await execAsync(
      `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -f ${outputPath}`,
      {
        env: { PGPASSWORD: password }
      }
    );
  }

  private async backupFiles(backupDir: string): Promise<void> {
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    await execAsync(`cp -r ${uploadDir} ${join(backupDir, 'files')}`);
  }

  private async compressBackup(
    backupDir: string,
    backupId: string
  ): Promise<string> {
    const archivePath = `${backupDir}.zip`;
    const output = createWriteStream(archivePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(backupDir, false);
    await archive.finalize();

    return archivePath;
  }

  private async encryptBackup(filePath: string): Promise<string> {
    const outputPath = `${filePath}.enc`;
    await execAsync(
      `openssl enc -aes-256-cbc -salt -in ${filePath} -out ${outputPath} -k ${this.encryptionKey}`
    );
    return outputPath;
  }

  private async decryptBackup(filePath: string): Promise<string> {
    const outputPath = filePath.replace('.enc', '');
    await execAsync(
      `openssl enc -d -aes-256-cbc -in ${filePath} -out ${outputPath} -k ${this.encryptionKey}`
    );
    return outputPath;
  }

  private async uploadToS3(
    filePath: string,
    backupId: string
  ): Promise<string> {
    const bucket = process.env.AWS_BACKUP_BUCKET;
    const key = `backups/${backupId}/${basename(filePath)}`;

    await this.s3.upload({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(filePath)
    }).promise();

    return `s3://${bucket}/${key}`;
  }

  private async downloadFromS3(location: string): Promise<string> {
    const [bucket, ...keyParts] = location.replace('s3://', '').split('/');
    const key = keyParts.join('/');
    const localPath = join(this.backupPath, basename(key));

    const response = await this.s3.getObject({
      Bucket: bucket,
      Key: key
    }).promise();

    await new Promise((resolve, reject) => {
      const writer = createWriteStream(localPath);
      writer.write(response.Body);
      writer.end();
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    return localPath;
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const { stdout } = await execAsync(`sha256sum ${filePath}`);
    return stdout.split(' ')[0];
  }

  private async cleanupOldBackups(config: BackupConfig): Promise<void> {
    const backups = await this.getBackups();
    const now = new Date();

    // Remove old backups based on retention days
    const oldBackups = backups.filter(backup => {
      const age = (now.getTime() - backup.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      return age > config.retention.days;
    });

    // Remove excess backups based on maxBackups
    const excessBackups = backups
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(config.retention.maxBackups);

    const backupsToRemove = [...oldBackups, ...excessBackups];

    for (const backup of backupsToRemove) {
      await this.deleteBackup(backup.id);
    }
  }

  private async deleteBackup(backupId: string): Promise<void> {
    const metadata = await this.getBackupMetadata(backupId);
    if (!metadata) return;

    const config = await this.getBackupConfig();

    if (config.storage === 's3') {
      const [bucket, ...keyParts] = metadata.location.replace('s3://', '').split('/');
      await this.s3.deleteObject({
        Bucket: bucket,
        Key: keyParts.join('/')
      }).promise();
    } else {
      await unlink(metadata.location);
    }

    await this.prisma.backupMetadata.delete({
      where: { id: backupId }
    });
  }

  private async getBackupConfig(): Promise<BackupConfig> {
    const config = await this.prisma.settings.findFirst({
      where: { category: 'backup' }
    });

    if (!config) {
      return {
        storage: 'local',
        retention: {
          days: 30,
          maxBackups: 10
        },
        schedule: {
          frequency: 'daily',
          time: '00:00'
        },
        includeFiles: true,
        compress: true,
        encrypt: false
      };
    }

    return config.settings as BackupConfig;
  }

  private async saveBackupMetadata(metadata: BackupMetadata): Promise<void> {
    await this.prisma.backupMetadata.create({
      data: metadata
    });
  }

  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    return this.prisma.backupMetadata.findUnique({
      where: { id: backupId }
    });
  }

  private async getFileSize(filePath: string): Promise<number> {
    const { size } = await promisify(stat)(filePath);
    return size;
  }

  private getDatabaseConfig() {
    return {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    };
  }
} 