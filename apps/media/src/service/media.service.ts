import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaResponse } from '../media-response';
import * as fs from 'fs';
import * as path from 'path';
import { Express } from 'express';

@Injectable()
export class MediaService {
  private readonly uploadRoot = path.join(process.cwd(), 'uploads');

  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('media.base_url') || 'http://localhost:4000';
    if (!fs.existsSync(this.uploadRoot)) {
      fs.mkdirSync(this.uploadRoot, { recursive: true });
    }
  }

  private generateFilename(originalName: string, mimetype?: string): string {
    let ext = path.extname(originalName);

    // If extension is missing or generic (.tmp, .bin), try to resolve from mimetype
    if ((!ext || ext === '.tmp' || ext === '.bin') && mimetype) {
      const mimeMap: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'video/mp4': '.mp4',
        'video/quicktime': '.mov',
        'application/pdf': '.pdf',
        'text/plain': '.txt',
        'application/json': '.json',
        'text/html': '.html',
      };
      
      const resolvedExt = mimeMap[mimetype];
      if (resolvedExt) {
        ext = resolvedExt;
      }
    }

    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const random = Math.floor(1000 + Math.random() * 9000); // 4 random digits
    return `${date}-${random}${ext}`;
  }

  /**
   * Upload file từ Multer (image, video, etc.)
   */
  async uploadFile(file: any, folder: string = ''): Promise<any> {
    const targetDir = path.join(this.uploadRoot, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filename = this.generateFilename(file.originalname || 'upload.bin', file.mimetype);
    const filePath = path.join(targetDir, filename);

    // If file is from microservice, it might be a buffer or have a buffer property
    const buffer = file.buffer?.data ? Buffer.from(file.buffer.data) : (Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer));

    fs.writeFileSync(filePath, buffer);

    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    const url = `${this.baseUrl}/${relativePath}`;

    return {
      secure_url: url,
      relative_path: relativePath, // Add relative path for database storage
      public_id: path.join(folder, filename).replace(/\\/g, '/'),
      original_filename: filename,
    };
  }

  /**
   * Upload file từ Buffer (universal method)
   */
  async uploadFromBuffer(
    buffer: any,
    filename: string,
    folder: string = '',
    resourceType: 'auto' | 'image' | 'video' | 'raw' = 'auto',
    mimetype?: string
  ): Promise<any> {
    const targetDir = path.join(this.uploadRoot, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const newFilename = this.generateFilename(filename, mimetype);
    const filePath = path.join(targetDir, newFilename);

    const dataBuffer = buffer?.data ? Buffer.from(buffer.data) : (Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));

    fs.writeFileSync(filePath, dataBuffer);

    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    const url = `${this.baseUrl}/${relativePath}`;

    return {
      secure_url: url,
      relative_path: relativePath, // Add relative path for database storage
      public_id: path.join(folder, newFilename).replace(/\\/g, '/'),
      original_filename: newFilename,
    };
  }
  /**
   * Upload raw file (base64)
   */
  async uploadRawFromBase64(
    base64String: string,
    filename: string,
    folder: string = 'raw-files'
  ): Promise<any> {
    const targetDir = path.join(this.uploadRoot, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const buffer = Buffer.from(base64String, 'base64');
    const newFilename = this.generateFilename(filename);
    const filePath = path.join(targetDir, newFilename);

    fs.writeFileSync(filePath, buffer);

    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    const url = `${this.baseUrl}/${relativePath}`;

    return {
      secure_url: url,
      public_id: path.join(folder, newFilename).replace(/\\/g, '/'),
    };
  }

  /**
   * Delete file từ local
   */
  async deleteFile(
    publicId: string,
    resourceType: 'image' | 'video' | 'raw' = 'image'
  ): Promise<any> {
    const filePath = path.join(this.uploadRoot, publicId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { result: 'ok' };
    }
    return { result: 'not found' };
  }

  /**
   * Upload JSON data cho Sign Language Detection
   */
  async uploadJson(jsonData: any, options: {
    folder?: string;
    public_id?: string;
    tags?: string[];
    resource_type?: 'raw';
  } = {}): Promise<any> {
    const folder = options.folder || 'sign-language/gestures';
    const targetDir = path.join(this.uploadRoot, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const jsonString = typeof jsonData === 'string'
      ? jsonData
      : JSON.stringify(jsonData, null, 2);

    const filename = `${options.public_id || `gesture_${Date.now()}`}.json`;
    const filePath = path.join(targetDir, filename);

    fs.writeFileSync(filePath, jsonString, 'utf-8');

    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    const url = `${this.baseUrl}/${relativePath}`;

    return {
      secure_url: url,
      public_id: path.join(folder, filename).replace(/\\/g, '/'),
    };
  }

  /**
   * Upload buffer với options linh hoạt
   */
  async uploadBuffer(buffer: any, options: {
    folder?: string;
    public_id?: string;
    tags?: string[];
    resource_type?: 'image' | 'video' | 'raw';
    transformation?: any[];
    format?: string;
  } = {}): Promise<any> {
    const folder = options.folder || 'sign-language/frames';
    const targetDir = path.join(this.uploadRoot, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const dataBuffer = buffer?.data ? Buffer.from(buffer.data) : (Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
    const filename = `${options.public_id || `frame_${Date.now()}`}.${options.format || 'jpg'}`;
    const filePath = path.join(targetDir, filename);

    fs.writeFileSync(filePath, dataBuffer);

    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    const url = `${this.baseUrl}/${relativePath}`;

    return {
      secure_url: url,
      public_id: path.join(folder, filename).replace(/\\/g, '/'),
    };
  }
}
