import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CacheService } from 'libs/cache.service';
import { JwtModule } from '@nestjs/jwt';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { AppointmentController } from '../controller/appointment.controller';
import { AppointmentService } from '../service/appointment.service';
import { Appointment, AppointmentSchema } from '../core/schema/Appointment.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),

    // JWT cấu hình global
    JwtModule.register({
      global: true,
      secret: 'secretKey',
      signOptions: { expiresIn: '24h' },
    }),

    // MongoDB kết nối động
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const isDev = configService.get<string>('isDev') === 'true';
        const uri = isDev
          ? configService.get<string>('MONGO_URI_DEV')
          : configService.get<string>('MONGO_URI_APPOINTMENT');
        return { uri };
      },
      inject: [ConfigService],
      connectionName: 'appointmentConnection',
    }),

    // Redis cache config (phải async)
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        // @ts-ignore
        store: new KeyvRedis('rediss://red-d071mk9r0fns7383v3j0:DeNbSrFT3rDj2vhGDGoX4Pr2DgHUBP8H@singapore-keyvalue.render.com:6379'),
        ttl: 3600 * 1000,
      }),
    }),

    MongooseModule.forFeature(
      [{ name: Appointment.name, schema: AppointmentSchema }],
      'appointmentConnection',
    ),

    // Microservice client
    ClientsModule.register([
      {
        name: 'USERS_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3001,
        },
      },
      {
        name: 'DOCTOR_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3003,
        },
      },
      {
        name: 'SPECIALTY_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3009,
        },
      },
      {
        name: 'REVIEW_CLIENT',
        transport: Transport.TCP,
        options: {
          host: 'localhost',
          port: 3018,
        },
      }
    ]),
  ],
  controllers: [AppointmentController],
  providers: [AppointmentService, CacheService],
})
export class AppointmentModule { }
