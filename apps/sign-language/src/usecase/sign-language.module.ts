import { Module } from '@nestjs/common';
import { SignLanguageController } from  '../controller/sign-language.controller';
import { SignLanguageService } from  '../service/sign-language.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { MongooseModule } from '@nestjs/mongoose';
import { SignLanguage, SignLanguageSchema } from 'apps/sign-language/core/sign_language.schema';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config]
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const isDev = configService.get<string>('isDev') === 'true';
        const uri = isDev
          ? configService.get<string>('MONGO_URI_DEV')
          : configService.get<string>('MONGO_URI_SIGNLANGUAGE');
        return { uri };
      },
      inject: [ConfigService],
      connectionName: 'signLanguageConnection',
    }),
  MongooseModule.forFeature([
    { name: SignLanguage.name, schema: SignLanguageSchema }], 'signLanguageConnection'),
  ClientsModule.register([
    {
      name: 'CLOUDINARY_CLIENT',
      transport: Transport.TCP,
      options: {
        port: 3006,
      },
    },
    {
      name: 'UNDERTHESEA_CLIENT',
      transport: Transport.TCP,
      options: {
        port: 3003,
      },
    }
  ]),
  ],
  controllers: [SignLanguageController],
  providers: [SignLanguageService],
})
export class SignLanguageModule {}
