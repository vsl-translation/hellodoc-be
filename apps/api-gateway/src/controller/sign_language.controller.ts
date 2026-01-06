import { Controller, Get, Post, Body, Query, Res, HttpStatus } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Response } from 'express';
import { SignLanguageService } from '../services/sign_language.service';

@Controller('gesture-code')
export class SignLanguageController {
  constructor(private readonly signLanguageService: SignLanguageService) { }

  @Post('post-video-url')
  async postVideoUrl(@Body() urlMedia: string) {
    return this.signLanguageService.postVideoUrl(urlMedia);
  }

  @Get('get-gesture_code')
  async getGestureWordCode(@Body() videoUrl: string) {
    return this.signLanguageService.getGestureWordCode(videoUrl);
  }

}
