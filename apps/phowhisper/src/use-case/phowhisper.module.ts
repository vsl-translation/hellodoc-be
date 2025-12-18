import { Module } from '@nestjs/common';
import { PhowhisperController } from '../controller/phowhisper.controller';
import { PhowhisperService } from '../service/phowhisper.service';
import { MongooseModule } from '@nestjs/mongoose';
import { VideoSubtitle, VideoSubtitleSchema } from '../core/subtitle.schema';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import config from 'apps/config/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [ 
     ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          load: [config],
        }),
    MongooseModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => {
          const isDev = configService.get<string>('isDev') === 'true';
          const uri = isDev
            ? configService.get<string>('MONGO_URI_DEV')
            : configService.get<string>('MONGO_URI_VIDEOSUBTITLE');
  
          return { uri };
        },
        inject: [ConfigService],
        connectionName: 'subtitleConnection',
      }),
    
    MongooseModule.forFeature([
      { name: VideoSubtitle.name, schema: VideoSubtitleSchema }],'subtitleConnection',
    ),
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        timeout: 10000,
        maxRedirects: 5,
      }),
      inject: [ConfigService],
    }),
    ClientsModule.register([
      {
        name: 'CLOUDINARY_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3006,
        },
      },
    ]),
  ],
  controllers: [PhowhisperController],
  providers: [PhowhisperService],
})
export class PhowhisperModule {}
