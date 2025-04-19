import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { Logger } from '../utils/logger';

interface StorageOptions {
  bucket: string;
  key: string;
  contentType?: string;
  expiresIn?: number;
}

export class StorageService extends BaseService {
  private s3Client: S3Client;
  private logger: Logger;

  constructor(deps: { prisma: any; redis: any; logger: Logger }) {
    super(deps.prisma, deps.redis, deps.logger);
    this.logger = deps.logger;
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async uploadFile(file: Buffer, options: StorageOptions): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: options.bucket,
        Key: options.key,
        Body: file,
        ContentType: options.contentType,
      });

      await this.s3Client.send(command);
      this.logger.info('File uploaded successfully', { key: options.key });
      return options.key;
    } catch (error) {
      this.logger.error('Failed to upload file', { error });
      throw new ValidationError('Failed to upload file');
    }
  }

  async getSignedUrl(options: StorageOptions): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: options.bucket,
        Key: options.key,
      });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: options.expiresIn || 3600,
      });

      return url;
    } catch (error) {
      this.logger.error('Failed to generate signed URL', { error });
      throw new ValidationError('Failed to generate signed URL');
    }
  }

  async deleteFile(options: StorageOptions): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: options.bucket,
        Key: options.key,
      });

      await this.s3Client.send(command);
      this.logger.info('File deleted successfully', { key: options.key });
    } catch (error) {
      this.logger.error('Failed to delete file', { error });
      throw new ValidationError('Failed to delete file');
    }
  }
} 