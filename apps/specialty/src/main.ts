import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SpecialtyModule } from './use-case/specialty.module';


async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    SpecialtyModule,
    {
      transport: Transport.TCP,
      options: {
        port: 3009,
      },
    },
  );
  await app.listen();
  console.log('Specialty service is listening on port 3009');
}
bootstrap();
