import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryResponse } from '../cloudinary-response';
const streamifier = require('streamifier');
import { Express } from 'express';

@Injectable()
export class CloudinaryService {
  /**
   * Upload file từ Multer (image, video, etc.)
   */
  uploadFile(file: Express.Multer.File, folder: string = ''): Promise<CloudinaryResponse> {
    return new Promise<CloudinaryResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) return reject(error);
          if (result) {
            resolve(result);
          } else {
            reject(new Error('Upload result is undefined'));
          }
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  /**
   * Upload file từ Buffer (universal method)
   * Hỗ trợ cả image, video, và raw files (srt, txt, json, etc.)
   */
  uploadFromBuffer(
    buffer: Buffer,
    filename: string,
    folder: string = '',
    resourceType: 'auto' | 'image' | 'video' | 'raw' = 'auto'
  ): Promise<CloudinaryResponse> {
    return new Promise<CloudinaryResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: resourceType,
          filename_override: filename,
          use_filename: true,
          unique_filename: false,
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            return reject(error);
          }
          if (result) {
            resolve(result);
          } else {
            reject(new Error('Upload result is undefined'));
          }
        },
      );

      // Pipe buffer to upload stream
      const readableStream = streamifier.createReadStream(buffer);
      readableStream.pipe(uploadStream);
    });
  }

  /**
   * Upload raw file từ base64 string (cho SRT, TXT, JSON, etc.)
   */
  uploadRawFromBase64(
    base64String: string,
    filename: string,
    folder: string = 'raw-files'
  ): Promise<CloudinaryResponse> {
    return new Promise<CloudinaryResponse>((resolve, reject) => {
      if (!base64String) {
        return reject(new Error('Base64 string is required'));
      }

      if (!filename) {
        return reject(new Error('Filename is required'));
      }

      // Convert base64 to buffer
      const buffer = Buffer.from(base64String, 'base64');

      // Xác định resource_type từ extension
      const ext = filename.split('.').pop()?.toLowerCase();
      const isMediaFile = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'avi', 'mov'].includes(ext || '');
      const resourceType = isMediaFile ? 'auto' : 'raw';

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: resourceType,
          public_id: filename.replace(/\.[^/.]+$/, ''), // Remove extension for public_id
          use_filename: true,
          unique_filename: false,
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload raw error:', error);
            return reject(error);
          }
          if (result) {
            resolve(result);
          } else {
            reject(new Error('Upload result is undefined'));
          }
        },
      );

      // Pipe buffer to upload stream
      const readableStream = streamifier.createReadStream(buffer);
      readableStream.pipe(uploadStream);
    });
  }

  /**
   * Delete file từ Cloudinary
   */
  async deleteFile(
    publicId: string,
    resourceType: 'image' | 'video' | 'raw' = 'image'
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(
        publicId,
        { resource_type: resourceType },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
    });
  }
}