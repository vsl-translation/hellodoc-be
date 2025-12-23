import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PhowhisperService {
  private readonly logger = new Logger(PhowhisperService.name);

  constructor(
    @Inject('PHOWHISPER_CLIENT') private readonly phowhisperClient: ClientProxy,
  ) {}

  /**
   * Gọi microservice để xử lý file upload
   */
  async getSubtitle(videoUrl?: string, file?: Express.Multer.File) {
    if (!videoUrl && !file) {
        throw new BadRequestException('Cần cung cấp videoUrl hoặc file');
    }

    this.logger.log('Sending subtitle request to microservice');

    try {
        const result = await firstValueFrom(
        this.phowhisperClient.send(
            'subtitle.getSubtitle',
            { videoUrl, file },
        ),
        );

        return result;
    } catch (error) {
        this.logger.error('Error calling phowhisper microservice', error);
        throw error;
    }
  }


  /**
   * Download file subtitle từ microservice
   */
  async downloadSubtitle(requestId: string, fileType: 'srt' | 'txt') {
    this.logger.log(`Downloading ${fileType} file for requestId: ${requestId}`);
    
    try {
      const result = await firstValueFrom(
        this.phowhisperClient.send('subtitle.downloadSubtitle', { 
          requestId, 
          fileType 
        })
      );
      
      return result;
    } catch (error) {
      this.logger.error('Error downloading subtitle', error);
      throw error;
    }
  }
}