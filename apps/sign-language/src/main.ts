// import { NestFactory } from '@nestjs/core';
// import { SignLanguageModule } from './usecase/sign-language.module';

// async function bootstrap() {
//   const app = await NestFactory.create(SignLanguageModule);
//   await app.listen(process.env.port ?? 3025);
// }
// bootstrap();

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SignLanguageModule } from './usecase/sign-language.module';


async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    SignLanguageModule,
    {
      transport: Transport.TCP,
      options: {
        port: 3025,
      },
    },
  );
  await app.listen();
  console.log('Specialty service is listening on port 3025');
}
bootstrap();

