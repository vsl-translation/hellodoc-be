import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { PhowhisperModule } from './use-case/phowhisper.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    PhowhisperModule,
    {
      transport: Transport.TCP,
      options: {
        port: 3024,
      },
    },
  );  

  await app.listen();
  console.log('Phowhisper service is listening on port 3024');
}

bootstrap();