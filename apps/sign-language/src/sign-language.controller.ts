import { Controller, Get } from '@nestjs/common';
import { SignLanguageService } from './sign-language.service';

@Controller()
export class SignLanguageController {
  constructor(private readonly signLanguageService: SignLanguageService) {}

  @Get()
  getHello(): string {
    return this.signLanguageService.getHello();
  }
}
