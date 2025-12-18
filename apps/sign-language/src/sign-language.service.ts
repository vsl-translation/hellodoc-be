import { Injectable } from '@nestjs/common';

@Injectable()
export class SignLanguageService {
  getHello(): string {
    return 'Hello World!';
  }
}
