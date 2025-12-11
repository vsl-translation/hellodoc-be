import { NestFactory } from '@nestjs/core';
import { UsersModule } from './use-case/users.module';

async function bootstrap() {
  const app = await NestFactory.create(UsersModule);

  // Enable CORS nếu cần
  app.enableCors();

  const port = 3001;
  await app.listen(port);
  console.log(`Users service is listening on port ${port}`);
}
bootstrap();