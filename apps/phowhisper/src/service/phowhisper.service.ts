import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as FormData from 'form-data';
import { AxiosError } from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VideoSubtitle } from '../core/subtitle.schema';
import axios from 'axios';

@Injectable()
export class PhowhisperService {  
  
  // URL của Server Python (Ngrok URL hoặc Localhost)
  // LƯU Ý: Thay URL này bằng URL Ngrok public của bạn mỗi khi chạy lại Colab
  constructor(
    private readonly httpService: HttpService,
    @InjectModel(VideoSubtitle.name, 'subtitleConnection') private videoSubtitleModel: Model<VideoSubtitle>,
  ) {}
  /**
   * Tạo subtitle từ Video URL hoặc File Upload
   */
  private PHOWHISPER_URL = process.env.PHOWHISPER_URL || 'https://veinless-unslanderously-jordyn.ngrok-free.dev';

  async generateSubtitle(videoUrl?: string, file?: Express.Multer.File) {
    if (!videoUrl && !file) {
      throw new HttpException(
        'Vui lòng cung cấp Video URL hoặc File',
        HttpStatus.BAD_REQUEST,
      );
    }

    // ==============================
    // 1️⃣ CHECK DB
    // ==============================
    if (videoUrl) {
      const existed = await this.videoSubtitleModel.findOne({ videoUrl });
      if (existed) {
        return {
          cached: true,
          videoUrl: existed.videoUrl,
          subtitleUrl: existed.subtitleUrl,
        };
      }
    }

    // ==============================
    // 2️⃣ GỌI PYTHON API
    // ==============================
    const endpoint = `${this.PHOWHISPER_URL}/api/phowhisper/generate-subtitle`;
    let response;

    try {
      if (videoUrl) {
        response = await axios.post(endpoint, {
          url: videoUrl, // ⚠️ đúng key python server đang dùng
        });
      } else if (file) {
        const formData = new FormData();
        formData.append('video', file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype,
        });

        response = await firstValueFrom(
          this.httpService.post(endpoint, formData, {
            headers: formData.getHeaders(),
          }),
        );
      }

      // ==============================
      // 3️⃣ PARSE RESPONSE ĐÚNG
      // ==============================
      const { request_id, downloads, success } = response.data;

      if (!success || !downloads?.srt) {
        throw new Error('Python API không trả về subtitle hợp lệ');
      }

      const subtitleUrl = `${this.PHOWHISPER_URL}${downloads.srt}`;

      // ==============================
      // 4️⃣ LƯU DB
      // ==============================
      if (videoUrl) {
        await this.videoSubtitleModel.create({
          videoUrl,
          subtitleUrl,
        });
      }

      return {
        cached: false,
        videoUrl,
        subtitleUrl,
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
          responseType: 'stream', // Quan trọng để nhận file stream
        })
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: any) {
    if (error instanceof AxiosError) {
        console.error(`Python API Error: ${error.message}`, error.response?.data);
        throw new HttpException(
            error.response?.data || 'Lỗi từ phía AI Server', 
            error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
        );
    }
    console.error('Internal Error', error);
    throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}