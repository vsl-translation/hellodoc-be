import { Controller } from '@nestjs/common';
import { CloudinaryService } from  '../service/cloudinary.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InternalServerErrorException } from '@nestjs/common';

@Controller()
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  /**
   * Pattern gốc - Upload từ buffer (base64)
   * Dùng cho general purpose upload
   * Accepts: 'buffer' hoặc 'file' field (backward compatible)
   */
  @MessagePattern('cloudinary.upload')
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
      console.log(`📤 [cloudinary.upload] Received payload:`, {
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
      const result = await this.cloudinaryService.uploadFromBuffer(
        bufferData,
        payload.filename,
        payload.folder,
        resourceType,
      );

      console.log(`✅ [cloudinary.upload] Success: ${result.secure_url}`);
      return result;

    } catch (error) {
      console.error('❌ [cloudinary.upload] Error:', error.message);
      console.error('Stack:', error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Pattern mới - Upload raw file (SRT, TXT, JSON, etc.)
   * Tối ưu cho non-media files
   */
  @MessagePattern('cloudinary.upload-raw')
  async uploadRaw(
    @Payload() payload: { 
      file: string;      // base64 string
      filename: string; 
      folder?: string;
    },
  ) {
    try {
      console.log(`📤 [cloudinary.upload-raw] Uploading: ${payload.filename}`);
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
      const result = await this.cloudinaryService.uploadRawFromBase64(
        payload.file,
        payload.filename,
        payload.folder || 'raw-files',
      );

      console.log(`✅ [cloudinary.upload-raw] Success: ${result.secure_url}`);
      return result;

    } catch (error) {
      console.error('❌ [cloudinary.upload-raw] Error:', error.message);
      console.error('Stack:', error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Upload file từ Multer.File object
   * Dùng khi upload trực tiếp từ form-data
   */
  @MessagePattern('cloudinary.upload-file')
  async uploadFile(
    @Payload() payload: { 
      file: Express.Multer.File; 
      folder?: string;
    },
  ) {
    try {
      console.log(`📤 [cloudinary.upload-file] Uploading file`);

      if (!payload.file || !payload.file.buffer) {
        throw new Error('File or file buffer is required');
      }

      const result = await this.cloudinaryService.uploadFile(
        payload.file,
        payload.folder || '',
      );

      console.log(`✅ [cloudinary.upload-file] Success: ${result.secure_url}`);
      return result;

    } catch (error) {
      console.error('❌ [cloudinary.upload-file] Error:', error.message);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Delete file from Cloudinary
   */
  @MessagePattern('cloudinary.delete-file')
  async deleteFile(
    @Payload() payload: { 
      publicId: string; 
      resourceType?: 'image' | 'video' | 'raw' 
    },
  ) {
    try {
      console.log(`🗑️ [cloudinary.delete-file] Deleting: ${payload.publicId}`);

      if (!payload.publicId) {
        throw new Error('Public ID is required');
      }

      const result = await this.cloudinaryService.deleteFile(
        payload.publicId,
        payload.resourceType || 'image',
      );

      console.log(`✅ [cloudinary.delete-file] Deleted successfully`);
      return {
        status: 'success',
        data: result,
      };

    } catch (error) {
      console.error('❌ [cloudinary.delete-file] Error:', error.message);
      return {
        status: 'error',
        message: error.message || 'Delete failed',
      };
    }
  }
}