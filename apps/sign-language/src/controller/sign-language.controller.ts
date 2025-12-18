import { Controller, Get } from '@nestjs/common';
import { SignLanguageService } from '../service/sign-language.service';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class SignLanguageController {
  constructor(private readonly signLanguageService: SignLanguageService) {}

  @MessagePattern('gesture_code.getGestureCode')
  async getGestureCode(urlMedia:string){
    return this.signLanguageService.getGestureCode(urlMedia)
  }
}
