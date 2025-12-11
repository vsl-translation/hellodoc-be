import { NestFactory } from '@nestjs/core';
import { DoctorModule } from './use-case/doctor.module';

async function bootstrap() {
  const app = await NestFactory.create(DoctorModule);

  // Enable CORS nếu cần
  app.enableCors();

  const port = 3003;
  await app.listen(port);
  console.log(`Doctor service is listening on port ${port}`);
}
bootstrap();