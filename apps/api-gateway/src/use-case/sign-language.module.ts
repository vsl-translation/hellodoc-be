import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SignLanguageService } from '../services/sign_language.service';
import { SignLanguageController } from '../controller/sign_language.controller';


@Module({
  imports: [
    ClientsModule.register([
    {
      name: 'SIGNLANGUAGE_CLIENT',
      transport: Transport.TCP,
      options: {
        port: 3025,
      },
    }
    ]),
  ],
  controllers: [SignLanguageController],
  providers: [SignLanguageService],
})
export class SignLanguageModule {}