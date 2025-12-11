import { NestFactory } from '@nestjs/core';
import { AdminModule } from './use-case/admin.module';

async function bootstrap() {
  const app = await NestFactory.create(AdminModule);

  // Enable CORS nếu cần
  app.enableCors();

  const port = 3010;
  await app.listen(port);
  console.log(`Admin service is listening on port ${port}`);
}
bootstrap();