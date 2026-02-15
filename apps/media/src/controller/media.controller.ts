import { Controller } from '@nestjs/common';
import { MediaService } from '../service/media.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InternalServerErrorException } from '@nestjs/common';

@Controller()
export class MediaController {
  constructor(private readonly mediaService: MediaService) { }

  /**
   * Pattern gốc - Upload từ buffer (base64)
   * Dùng cho general purpose upload
   * Accepts: 'buffer' hoặc 'file' field (backward compatible)
   */
  @MessagePattern('media.upload')
  async upload(
    @Payload() payload: {
      buffer?: string;    // base64 string (old field name)
      file?: string;      // base64 string (new field name) 
      filename: string;
      mimetype?: string;
      folder: string
    },
  ) {
    try {
      console.log(`📤 [media.upload] Received payload:`, {
        hasBuffer: !!payload.buffer,
        hasFile: !!payload.file,
        filename: payload.filename,
        folder: payload.folder,
      });

      // Accept both 'buffer' and 'file' field names
      const base64String = payload.buffer || payload.file;

      // Validate input
      if (!base64String) {
        throw new Error('Buffer or file (base64 string) is required');
      }

      if (!payload.filename) {
        throw new Error('Filename is required');
      }

      console.log(`📦 Base64 length: ${base64String.length}, Filename: ${payload.filename}`);

      // Convert Base64 string to Buffer
      const bufferData = Buffer.from(base64String, 'base64');
      console.log(`📦 Buffer size: ${bufferData.length} bytes`);

      // Xác định resource type từ mimetype hoặc extension
      let resourceType: 'auto' | 'raw' = 'auto';
      if (payload.mimetype) {
        // Nếu là text file hoặc application file → raw
        if (payload.mimetype.startsWith('text/') ||
          payload.mimetype.includes('json') ||
          payload.mimetype.includes('xml') ||
          payload.mimetype === 'application/octet-stream') {
          resourceType = 'raw';
        }
      } else {
        // Fallback: check extension
        const ext = payload.filename.split('.').pop()?.toLowerCase();
        const rawExtensions = ['srt', 'txt', 'json', 'xml', 'csv', 'pdf', 'doc', 'docx'];
        if (ext && rawExtensions.includes(ext)) {
          resourceType = 'raw';
        }
      }

      console.log(`📦 Resource type: ${resourceType}`);

      // Upload using service
      const result = await this.mediaService.uploadFromBuffer(
        bufferData,
        payload.filename,
        payload.folder,
        resourceType,
        payload.mimetype,
      );

      console.log(`✅ [media.upload] Success: ${result.secure_url}`);
      return result;

    } catch (error) {
      console.error('❌ [media.upload] Error:', error.message);
      console.error('Stack:', error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Pattern mới - Upload raw file (SRT, TXT, JSON, etc.)
   * Tối ưu cho non-media files
   */
  @MessagePattern('media.upload-raw')
  async uploadRaw(
    @Payload() payload: {
      file: string;      // base64 string
      filename: string;
      folder?: string;
    },
  ) {
    try {
      console.log(`📤 [media.upload-raw] Uploading: ${payload.filename}`);
      console.log(`📦 Payload:`, {
        hasFile: !!payload.file,
        fileLength: payload.file?.length,
        filename: payload.filename,
        folder: payload.folder,
      });

      // Validate input
      if (!payload.file) {
        throw new Error('File content (base64 string) is required');
      }

      if (!payload.filename) {
        throw new Error('Filename is required');
      }

      // Upload using service
      const result = await this.mediaService.uploadRawFromBase64(
        payload.file,
        payload.filename,
        payload.folder || 'raw-files',
      );

      console.log(`✅ [media.upload-raw] Success: ${result.secure_url}`);
      return result;

    } catch (error) {
      console.error('❌ [media.upload-raw] Error:', error.message);
      console.error('Stack:', error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Upload file từ Multer.File object
   * Dùng khi upload trực tiếp từ form-data
   */
  @MessagePattern('media.upload-file')
  async uploadFile(
    @Payload() payload: {
      file: Express.Multer.File;
      folder?: string;
    },
  ) {
    try {
      console.log(`📤 [media.upload-file] Uploading file`);

      if (!payload.file || !payload.file.buffer) {
        throw new Error('File or file buffer is required');
      }

      const result = await this.mediaService.uploadFile(
        payload.file,
        payload.folder || '',
      );

      console.log(`✅ [media.upload-file] Success: ${result.secure_url}`);
      return result;

    } catch (error) {
      console.error('❌ [media.upload-file] Error:', error.message);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Delete file from Media
   */
  @MessagePattern('media.delete-file')
  async deleteFile(
    @Payload() payload: {
      publicId: string;
      resourceType?: 'image' | 'video' | 'raw'
    },
  ) {
    try {
      console.log(`🗑️ [media.delete-file] Deleting: ${payload.publicId}`);

      if (!payload.publicId) {
        throw new Error('Public ID is required');
      }

      const result = await this.mediaService.deleteFile(
        payload.publicId,
        payload.resourceType || 'image',
      );

      console.log(`✅ [media.delete-file] Deleted successfully`);
      return {
        status: 'success',
        data: result,
      };

    } catch (error) {
      console.error('❌ [media.delete-file] Error:', error.message);
      return {
        status: 'error',
        message: error.message || 'Delete failed',
      };
    }
  }

  /**
 * Upload JSON data từ Sign Language Detection
 */
  @MessagePattern('media.upload-json')
  async uploadJson(
    @Payload() payload: {
      jsonData: any;        // JSON object hoặc string
      publicId?: string;    // optional custom public_id
      folder?: string;
      tags?: string[];
    },
  ) {
    try {
      console.log(`📤 [media.upload-json] Uploading JSON data`);

      // Validate input
      if (!payload.jsonData) {
        throw new Error('JSON data is required');
      }

      // Convert to string if object
      const jsonString = typeof payload.jsonData === 'string'
        ? payload.jsonData
        : JSON.stringify(payload.jsonData, null, 2);

      console.log(`📦 JSON size: ${jsonString.length} bytes`);

      const result = await this.mediaService.uploadJson(
        jsonString,
        {
          folder: payload.folder || 'sign-language/gestures',
          public_id: payload.publicId || `gesture_${Date.now()}`,
          tags: payload.tags || ['sign-language', 'gesture'],
          resource_type: 'raw'
        }
      );

      console.log(`✅ [media.upload-json] Success: ${result.secure_url}`);

      return {
        success: true,
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        created_at: result.created_at,
        bytes: result.bytes
      };

    } catch (error) {
      console.error('❌ [media.upload-json] Error:', error.message);
      throw new InternalServerErrorException(`Upload JSON failed: ${error.message}`);
    }
  }

  /**
   * Upload hình ảnh skeleton frame từ buffer
   */
  @MessagePattern('media.upload-gesture-image')
  async uploadGestureImage(
    @Payload() payload: {
      buffer: Buffer;
      publicId?: string;
      folder?: string;
      transformation?: any[];
      tags?: string[];
    },
  ) {
    try {
      console.log(`📤 [media.upload-gesture-image] Uploading gesture image`);

      if (!payload.buffer || !Buffer.isBuffer(payload.buffer)) {
        throw new Error('Valid buffer is required');
      }

      console.log(`📦 Image buffer size: ${payload.buffer.length} bytes`);

      // Default transformation cho skeleton frames
      const defaultTransformations = [
        { width: 800, crop: "limit" },
        { quality: "auto" },
        { fetch_format: "auto" }
      ];

      const result = await this.mediaService.uploadBuffer(
        payload.buffer,
        {
          folder: payload.folder || 'sign-language/frames',
          public_id: payload.publicId || `frame_${Date.now()}`,
          tags: payload.tags || ['sign-language', 'frame', 'skeleton'],
          transformation: payload.transformation || defaultTransformations,
          resource_type: 'image'
        }
      );

      console.log(`✅ [media.upload-gesture-image] Success: ${result.secure_url}`);

      return {
        success: true,
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes
      };

    } catch (error) {
      console.error('❌ [media.upload-gesture-image] Error:', error.message);
      throw new InternalServerErrorException(`Upload image failed: ${error.message}`);
    }
  }
}
