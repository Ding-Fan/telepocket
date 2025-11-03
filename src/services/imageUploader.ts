import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config/environment';
import crypto from 'crypto';

export interface UploadResult {
  cloudflareUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface UploadOptions {
  originalFileName?: string;
  mimeType: string;
}

class ImageUploader {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor() {
    // Initialize S3 client with R2 endpoint
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.cloudflareR2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.cloudflareR2.accessKeyId,
        secretAccessKey: config.cloudflareR2.secretAccessKey,
      },
      forcePathStyle: true, // Required for R2 compatibility
    });
    this.bucketName = config.cloudflareR2.bucketName;
    this.publicUrl = config.cloudflareR2.publicUrl;
  }

  async uploadImage(buffer: Buffer, options: UploadOptions): Promise<UploadResult> {
    // Validate image
    this.validateImage(buffer, options.mimeType);

    // Generate unique filename
    const fileName = this.generateUniqueFileName(
      options.originalFileName || 'image',
      options.mimeType
    );

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
      Body: buffer,
      ContentType: options.mimeType,
    });

    await this.s3Client.send(command);

    // Generate public URL
    const cloudflareUrl = `${this.publicUrl}/${fileName}`;

    return {
      cloudflareUrl,
      fileName,
      fileSize: buffer.length,
      mimeType: options.mimeType,
    };
  }

  private generateUniqueFileName(originalName: string, mimeType: string): string {
    const timestamp = Date.now();
    const uuid = crypto.randomUUID();

    // Sanitize original filename
    const sanitized = originalName
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[^a-z0-9.-]/gi, '-') // Replace special chars
      .toLowerCase()
      .substring(0, 50); // Limit length

    // Get extension from MIME type
    const ext = mimeType.split('/')[1] || 'jpg';

    return `${timestamp}-${uuid}-${sanitized}.${ext}`;
  }

  private validateImage(buffer: Buffer, mimeType: string): void {
    // Validate file size (19MB = 19 * 1024 * 1024 bytes)
    const maxSize = 19 * 1024 * 1024;
    if (buffer.length > maxSize) {
      throw new Error(
        `Image too large. Max size: 19MB (got ${(buffer.length / 1024 / 1024).toFixed(2)}MB)`
      );
    }

    // Validate MIME type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(mimeType)) {
      throw new Error(`Unsupported format. Use JPG, PNG, or WebP (got ${mimeType})`);
    }
  }
}

export const imageUploader = new ImageUploader();
