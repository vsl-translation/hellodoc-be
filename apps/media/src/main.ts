import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { MediaModule } from './use-case/media.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    MediaModule,
    {
      transport: Transport.TCP,
      options: {
        port: 3006,
      },
    },
  );
  await app.listen();
  console.log('Media service is listening on port 3006');
}
bootstrap();
