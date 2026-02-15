import { Module } from '@nestjs/common';
import { SignLanguageController } from '../controller/sign-language.controller';
import { SignLanguageService } from '../service/sign-language.service';
import { MediaUrlHelper } from 'libs/media-url.helper';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { HttpModule } from '@nestjs/axios';
import { Word, WordSchema } from 'apps/sign-language/core/schema/word.schema';
import { Video, VideoSchema } from 'apps/sign-language/core/schema/sign_language.schema';

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
      { name: Word.name, schema: WordSchema },
      { name: Video.name, schema: VideoSchema },
    ], 'signLanguageConnection'),
    ClientsModule.register([
      {
        name: 'MEDIA_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3006,
        },
      },
      {
        name: 'UNDERTHESEA_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3020,
        },
      },
      {
        name: 'PHOWHISPER_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3024,
        },
      },
    ]),
  ],
  controllers: [SignLanguageController],
  providers: [SignLanguageService, MediaUrlHelper],
})
export class SignLanguageModule { }
