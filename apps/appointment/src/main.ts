import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppointmentModule } from './use-case/appointment.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppointmentModule,
    {
      transport: Transport.TCP,
      options: {
        port: 3007,
      },
    },
  );
  await app.listen();
  console.log('Appointment service is listening on port 3007');
}
bootstrap();
