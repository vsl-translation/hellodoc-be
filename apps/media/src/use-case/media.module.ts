import { Module } from '@nestjs/common';
import { MediaService } from '../service/media.service';
import { MediaController } from '../controller/media.controller';
import { ConfigModule } from '@nestjs/config';
import config from 'apps/config/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),
  ],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule { }
