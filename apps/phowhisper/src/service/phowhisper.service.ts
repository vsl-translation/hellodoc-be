import {Inject, Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as FormData from 'form-data';
import { AxiosError } from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VideoSubtitle } from '../core/subtitle.schema';
import axios from 'axios';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class PhowhisperService {  
  
  constructor(
      private readonly httpService: HttpService,
      @InjectModel(VideoSubtitle.name, 'subtitleConnection') private videoSubtitleModel: Model<VideoSubtitle>,
      @Inject('CLOUDINARY_CLIENT') private readonly cloudinaryClient: ClientProxy, 
    ) {}
    private PHOWHISPER_URL = process.env.PHOWHISPER_URL || 'https://veinless-unslanderously-jordyn.ngrok-free.dev';

    async generateSubtitle(videoUrl?: string, file?: Express.Multer.File) {
    // 1. Chuẩn hóa input
    if (videoUrl) videoUrl = videoUrl.trim();

    if (!videoUrl && !file) {
      throw new HttpException('Vui lòng cung cấp Video URL hoặc File', HttpStatus.BAD_REQUEST);
    }

    // ==============================
    // 1️⃣ CHECK DB (Cache)
    // ==============================
    if (videoUrl) {
      const existed = await this.videoSubtitleModel.findOne({ videoUrl });
      if (existed) {
        console.log('✅ Found cached subtitle:', videoUrl);
        return {
          cached: true,
          videoUrl: existed.videoUrl,
          subtitleUrl: existed.subtitleUrl,
        };
      }
    }

    // ==============================
    // 2️⃣ GỌI PYTHON API (COLAB)
    // ==============================
    const endpoint = `${this.PHOWHISPER_URL}/api/phowhisper/generate-subtitle`;
    let response;

    try {
      console.log(`🚀 Sending request to Colab: ${endpoint}`);

      if (videoUrl) {
        // ⭐ OPTION 1: Gửi JSON cho đơn giản (Python API mới hỗ trợ)
        console.log('📦 Sending JSON body with URL:', videoUrl);
        
        response = await firstValueFrom(
          this.httpService.post(endpoint, 
            { url: videoUrl },  // JSON body
            {
              headers: {
                'Content-Type': 'application/json',
              },
              timeout: 600000, // 10 phút
            }
          ),
        );
      } else if (file) {
        // OPTION 2: Upload file qua form-data
        console.log('📦 Uploading file:', file.originalname);
        
        const formData = new FormData();
        formData.append('video', file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype,
        });

        response = await firstValueFrom(
          this.httpService.post(endpoint, formData, {
            headers: formData.getHeaders(),
            timeout: 600000,
          }),
        );
      }

      // ==============================
      // 3️⃣ XỬ LÝ KẾT QUẢ TỪ PYTHON
      // ==============================
      console.log('📥 Response from Python API:', JSON.stringify(response.data, null, 2));
      
      const { request_id, downloads, success } = response.data;

      if (!success || !downloads?.srt) {
        throw new Error('Python API không trả về subtitle hợp lệ');
      }

      // Link tạm thời (nằm trên Colab/Ngrok)
      const tempSrtUrl = `${this.PHOWHISPER_URL}${downloads.srt}`;
      console.log('⬇️ Downloading temp subtitle from:', tempSrtUrl);

      // ==============================
      // 4️⃣ TẢI FILE TẠM -> UPLOAD CLOUDINARY
      // ==============================
      
      const srtFileResponse = await firstValueFrom(
        this.httpService.get(tempSrtUrl, { 
          responseType: 'arraybuffer',
          timeout: 30000,
        })
      );

      if (!srtFileResponse.data) {
        throw new Error('Không thể tải file .srt từ Colab');
      }

      const srtBuffer = Buffer.from(srtFileResponse.data);
      const srtBase64 = srtBuffer.toString('base64');
      
      console.log(`☁️ Uploading to Cloudinary (Base64 size: ${srtBase64.length})...`);

      const cloudinaryResult = await firstValueFrom(
        this.cloudinaryClient.send('cloudinary.upload-raw', { 
          file: srtBase64,          
          filename: `${request_id}.srt`,
          folder: 'Subtitles',
        })
      );

      const permanentSubtitleUrl = cloudinaryResult.secure_url;
      console.log('✅ Upload success:', permanentSubtitleUrl);

      // ==============================
      // 5️⃣ LƯU VÀO MONGODB
      // ==============================
      if (videoUrl) {
        try {
          await this.videoSubtitleModel.create({
            videoUrl,
            subtitleUrl: permanentSubtitleUrl,
          });
        } catch (e) {
            if (e.code !== 11000) console.warn('DB Save Error:', e.message);
        }
      }

      return {
        cached: false,
        videoUrl,
        subtitleUrl: permanentSubtitleUrl,
        requestId: request_id,
      };

    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Download file SRT/TXT từ Python Server
   */
  async downloadSubtitle(requestId: string, fileType: 'srt' | 'txt') {
    const endpoint = `${this.PHOWHISPER_URL}/api/phowhisper/download/${requestId}/${fileType}`;
    console.log(`Downloading ${fileType} for request: ${requestId}`);

    try {
      const response = await firstValueFrom(
        this.httpService.get(endpoint, {
          responseType: 'stream',
        })
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: any) {
    if (error instanceof AxiosError) {
        console.error(`Python API Error: ${error.message}`);
        console.error('Response data:', error.response?.data);
        console.error('Response status:', error.response?.status);
        console.error('Request config:', {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
        });
        
        throw new HttpException(
            error.response?.data?.error || error.response?.data || 'Lỗi từ phía AI Server', 
            error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
        );
    }
    console.error('Internal Error', error);
    throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}