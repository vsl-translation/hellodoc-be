import { Controller, Get, Post, Body, Query, Res, HttpStatus } from '@nestjs/common';
import { PhowhisperService } from '../service/phowhisper.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Response } from 'express';

@Controller()
export class PhowhisperController {
  constructor(private readonly phowhisperService: PhowhisperService) {}

  @MessagePattern('subtitle.getSubtitle')
  async getSubtitle(
    @Payload()
    payload: {
      videoUrl?: string;
      file?: Express.Multer.File;
    },
  ) {
    console.log('Received payload in controller:', payload);
    const { videoUrl, file } = payload;
    return this.phowhisperService.generateSubtitle(videoUrl, file);
  }


  @MessagePattern("subtitle.downloadSubtitle")
  async downloadSubtitle(
    @Payload() data: { requestId: string; fileType: 'srt' | 'txt' },
  ) {
    return this.phowhisperService.downloadSubtitle(data.requestId, data.fileType);
  }
}
