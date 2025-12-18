import { Controller, Get, Post, Body, Query, Res, HttpStatus } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Response } from 'express';
import { SignLanguageService } from '../services/sign_language.service';

@Controller('gesture_code')
export class SignLanguageController {
  constructor(private readonly signLanguageService: SignLanguageService) {}

  @Post('get-gesture_code')
  async getGestureCode(
    @Payload()
    payload: {
      urlMedia?: string;
    },
  ) {
    const { urlMedia } = payload;
    return this.signLanguageService.getGestureCode(urlMedia);
  }


}
