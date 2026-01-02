import { NestFactory } from '@nestjs/core';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { UsersModule } from './use-case/users.module';

async function bootstrap() {
  dotenv.config();

  const isProduction = process.env.NODE_ENV === 'production';

  let serviceAccount;
  if (isProduction) {
    try {
      const serviceAccountPath = '/etc/secrets/firebase-service-account.json';
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    } catch (error) {
      console.error('Error loading Firebase service account from Render secrets:', error);
      process.exit(1);
    }
  } else {
    try {
      const serviceAccountPath = path.join(__dirname, '..', '..', '..', 'firebase-service-account.json');
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    } catch (error) {
      console.error('Error loading Firebase service account locally:', error);
      process.exit(1);
    }
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  // Thay đổi từ createMicroservice sang create
  const app = await NestFactory.create(UsersModule);

  // Enable CORS
  app.enableCors();

  const port = 3001;
  await app.listen(port);
  console.log(`Users service is listening on port ${port}`);
}
bootstrap();