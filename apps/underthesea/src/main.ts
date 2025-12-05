import { NestFactory } from '@nestjs/core';
import { UndertheseaModule } from './use-case/underthesea.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    UndertheseaModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: 3020,
      },
    },
  );
  await app.listen();
  console.log('Underthesea service is listening on port 3020');
}
bootstrap();
