import { NestFactory } from '@nestjs/core';
import { AuthModule } from './use-case/auth.module';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule);

  // Enable CORS nếu cần
  app.enableCors();

  const port = 3005;
  await app.listen(port);
  console.log(`Auth service is listening on port ${port}`);
}
bootstrap();