import { NestFactory } from '@nestjs/core';
import { SignLanguageModule } from './usecase/sign-language.module';

async function bootstrap() {
  const app = await NestFactory.create(SignLanguageModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
