import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { S3 } from 'aws-sdk';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, unlink, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import { Redis } from 'ioredis';

interface FileUploadOptions {
  storage?: 'local' | 's3';
  allowedTypes?: string[];
  maxSize?: number;
  path?: string;
  processImage?: boolean;
  imageOptions?: {
    resize?: {
      width?: number;
      height?: number;
      fit?: keyof sharp.FitEnum;
    };
    compress?: boolean;
    format?: 'jpeg' | 'png' | 'webp';
    quality?: number;
  };
}

interface FileMetadata {
  id: string;
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  storage: 'local' | 's3';
  url?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
  uploadedBy?: string;
  createdAt: Date;
}

export class FileService extends BaseService {
  private s3: S3;
  private readonly uploadPath: string;
  private readonly maxFileSize: number;
  private readonly allowedTypes: string[];
  private readonly bucketName: string;

  constructor(deps: any) {
    super(deps);
    
    this.uploadPath = process.env.UPLOAD_PATH || './uploads';
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB
    this.allowedTypes = (process.env.ALLOWED_FILE_TYPES || '').split(',');
    this.bucketName = process.env.AWS_S3_BUCKET || '';

    this.s3 = new S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });

    this.initializeStorage();
  }

  async uploadFile(
    file: Express.Multer.File,
    options: FileUploadOptions = {}
  ): Promise<FileMetadata> {
    try {
      // Validate file
      await this.validateFile(file, options);

      // Generate unique filename
      const filename = this.generateFilename(file.originalname);

      // Process image if needed
      let processedFile = file;
      if (options.processImage && this.isImage(file.mimetype)) {
        processedFile = await this.processImage(file, options.imageOptions);
      }

      // Upload file
      const storage = options.storage || 'local';
      const fileData = await (storage === 's3'
        ? this.uploadToS3(processedFile, filename, options)
        : this.uploadToLocal(processedFile, filename, options));

      // Create file record
      const metadata = await this.createFileRecord({
        ...fileData,
        originalName: file.originalname,
        storage,
        uploadedBy: options.uploadedBy
      });

      return metadata;
    } catch (error) {
      this.logger.error('File upload error:', error);
      throw error;
    }
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    options: FileUploadOptions = {}
  ): Promise<FileMetadata[]> {
    return Promise.all(files.map(file => this.uploadFile(file, options)));
  }

  async downloadFile(fileId: string): Promise<{
    stream: NodeJS.ReadableStream;
    metadata: FileMetadata;
  }> {
    const metadata = await this.getFileMetadata(fileId);
    if (!metadata) {
      throw new ValidationError('File not found');
    }

    if (metadata.storage === 's3') {
      const s3Object = await this.s3
        .getObject({
          Bucket: this.bucketName,
          Key: metadata.path
        })
        .promise();

      return {
        stream: s3Object.createReadStream(),
        metadata
      };
    } else {
      const filePath = join(this.uploadPath, metadata.path);
      const stream = createReadStream(filePath);
      return { stream, metadata };
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    const metadata = await this.getFileMetadata(fileId);
    if (!metadata) {
      throw new ValidationError('File not found');
    }

    if (metadata.storage === 's3') {
      await this.s3
        .deleteObject({
          Bucket: this.bucketName,
          Key: metadata.path
        })
        .promise();
    } else {
      const filePath = join(this.uploadPath, metadata.path);
      await unlink(filePath);

      // Delete thumbnail if exists
      if (metadata.thumbnailUrl) {
        const thumbnailPath = join(this.uploadPath, metadata.thumbnailUrl);
        await unlink(thumbnailPath).catch(() => {});
      }
    }

    await this.prisma.file.delete({
      where: { id: fileId }
    });
  }

  async getFileMetadata(fileId: string): Promise<FileMetadata | null> {
    return this.prisma.file.findUnique({
      where: { id: fileId }
    });
  }

  async generatePresignedUrl(
    fileId: string,
    expiresIn = 3600
  ): Promise<string> {
    const metadata = await this.getFileMetadata(fileId);
    if (!metadata) {
      throw new ValidationError('File not found');
    }

    if (metadata.storage !== 's3') {
      throw new ValidationError('Presigned URLs are only available for S3 storage');
    }

    const url = await this.s3.getSignedUrlPromise('getObject', {
      Bucket: this.bucketName,
      Key: metadata.path,
      Expires: expiresIn
    });

    return url;
  }

  async moveFile(
    fileId: string,
    newPath: string
  ): Promise<FileMetadata> {
    const metadata = await this.getFileMetadata(fileId);
    if (!metadata) {
      throw new ValidationError('File not found');
    }

    if (metadata.storage === 's3') {
      await this.s3
        .copyObject({
          Bucket: this.bucketName,
          CopySource: `${this.bucketName}/${metadata.path}`,
          Key: newPath
        })
        .promise();

      await this.s3
        .deleteObject({
          Bucket: this.bucketName,
          Key: metadata.path
        })
        .promise();
    } else {
      const oldPath = join(this.uploadPath, metadata.path);
      const newFullPath = join(this.uploadPath, newPath);
      await mkdir(dirname(newFullPath), { recursive: true });
      await rename(oldPath, newFullPath);
    }

    return this.prisma.file.update({
      where: { id: fileId },
      data: { path: newPath }
    });
  }

  async copyFile(
    fileId: string,
    newPath: string
  ): Promise<FileMetadata> {
    const metadata = await this.getFileMetadata(fileId);
    if (!metadata) {
      throw new ValidationError('File not found');
    }

    if (metadata.storage === 's3') {
      await this.s3
        .copyObject({
          Bucket: this.bucketName,
          CopySource: `${this.bucketName}/${metadata.path}`,
          Key: newPath
        })
        .promise();
    } else {
      const oldPath = join(this.uploadPath, metadata.path);
      const newFullPath = join(this.uploadPath, newPath);
      await mkdir(dirname(newFullPath), { recursive: true });
      await copyFile(oldPath, newFullPath);
    }

    const newMetadata = { ...metadata };
    delete newMetadata.id;

    return this.prisma.file.create({
      data: {
        ...newMetadata,
        path: newPath
      }
    });
  }

  private async initializeStorage(): Promise<void> {
    // Create local upload directory if it doesn't exist
    await mkdir(this.uploadPath, { recursive: true });

    // Verify S3 bucket exists and is accessible
    if (this.bucketName) {
      try {
        await this.s3.headBucket({ Bucket: this.bucketName }).promise();
      } catch (error) {
        this.logger.error('S3 bucket error:', error);
      }
    }
  }

  private async validateFile(
    file: Express.Multer.File,
    options: FileUploadOptions
  ): Promise<void> {
    // Check file size
    const maxSize = options.maxSize || this.maxFileSize;
    if (file.size > maxSize) {
      throw new ValidationError(
        `File size exceeds maximum limit of ${maxSize} bytes`
      );
    }

    // Check file type
    const allowedTypes = options.allowedTypes || this.allowedTypes;
    if (
      allowedTypes.length > 0 &&
      !allowedTypes.includes(file.mimetype)
    ) {
      throw new ValidationError(
        `File type ${file.mimetype} is not allowed`
      );
    }
  }

  private generateFilename(originalName: string): string {
    const ext = extname(originalName);
    return `${uuidv4()}${ext}`;
  }

  private async processImage(
    file: Express.Multer.File,
    options: FileUploadOptions['imageOptions'] = {}
  ): Promise<Express.Multer.File> {
    let image = sharp(file.buffer);

    // Resize if specified
    if (options.resize) {
      image = image.resize({
        width: options.resize.width,
        height: options.resize.height,
        fit: options.resize.fit || 'contain'
      });
    }

    // Convert format if specified
    if (options.format) {
      image = image.toFormat(options.format, {
        quality: options.quality || 80,
        ...(options.compress && { compression: 'high' })
      });
    }

    // Process image
    const buffer = await image.toBuffer();

    return {
      ...file,
      buffer,
      size: buffer.length
    };
  }

  private async uploadToS3(
    file: Express.Multer.File,
    filename: string,
    options: FileUploadOptions
  ): Promise<Partial<FileMetadata>> {
    const key = options.path
      ? join(options.path, filename)
      : filename;

    await this.s3
      .upload({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'private'
      })
      .promise();

    const url = `https://${this.bucketName}.s3.amazonaws.com/${key}`;

    return {
      filename,
      path: key,
      size: file.size,
      mimeType: file.mimetype,
      url
    };
  }

  private async uploadToLocal(
    file: Express.Multer.File,
    filename: string,
    options: FileUploadOptions
  ): Promise<Partial<FileMetadata>> {
    const relativePath = options.path
      ? join(options.path, filename)
      : filename;
    const fullPath = join(this.uploadPath, relativePath);

    await mkdir(dirname(fullPath), { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const writeStream = createWriteStream(fullPath);
      const readStream = createReadStream(file.buffer);

      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      readStream.pipe(writeStream);
    });

    return {
      filename,
      path: relativePath,
      size: file.size,
      mimeType: file.mimetype,
      url: `/uploads/${relativePath}`
    };
  }

  private async createFileRecord(
    data: Partial<FileMetadata>
  ): Promise<FileMetadata> {
    return this.prisma.file.create({
      data: {
        ...data,
        createdAt: new Date()
      }
    });
  }

  private isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }
} 