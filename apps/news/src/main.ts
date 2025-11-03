import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { NewsModule } from './use-case/news.module';
async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    NewsModule,
    {
      transport: Transport.TCP,
      options: {
        port: 3004,
      },
    },
  );
  await app.listen();
  console.log('News service is listening on port 3004');
}
bootstrap();
