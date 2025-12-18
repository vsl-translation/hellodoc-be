import { Module } from '@nestjs/common';
import { SignLanguageController } from './sign-language.controller';
import { SignLanguageService } from './sign-language.service';

@Module({
  imports: [],
  controllers: [SignLanguageController],
  providers: [SignLanguageService],
})
export class SignLanguageModule {}
