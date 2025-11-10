import { Module } from '@nestjs/common';
import { DoctorController } from '../controller/doctor.controller';
import { DoctorService } from '../service/doctor.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Doctor, DoctorSchema } from '../core/schema/doctor.schema';
import { CacheService } from 'libs/cache.service';
import { CacheModule } from '@nestjs/cache-manager';

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
          : configService.get<string>('MONGO_URI_PROD');

        return { uri };
      },
      inject: [ConfigService],
      connectionName: 'doctorConnection',
    }),
    MongooseModule.forFeature(
      [{ name: Doctor.name, schema: DoctorSchema }],
      'doctorConnection',
    ),
    CacheModule.register(),
  ],
  controllers: [DoctorController],
  providers: [DoctorService, CacheService],
})
export class DoctorModule { }
