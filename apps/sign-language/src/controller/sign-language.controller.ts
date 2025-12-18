import { Controller, Get } from '@nestjs/common';
import { SignLanguageService } from '../service/sign-language.service';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class SignLanguageController {
  constructor(private readonly signLanguageService: SignLanguageService) {}

  @MessagePattern('gesture_code.getGestureCode')
  async getGestureCode(@Payload ()payload:{urlMedia: string}){
    const urlMedia = payload.urlMedia
    console.log("Vao duoc controler")
    return this.signLanguageService.getGestureCode(urlMedia)
  }
}
