import { Module } from '@nestjs/common';
import { AuthController } from '../controller/auth.controller';
import { AuthService } from '../service/auth.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CacheService } from 'libs/cache.service';
import { JwtModule } from '@nestjs/jwt';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';

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
          : configService.get<string>('MONGO_URI_PROD');
        return { uri };
      },
      inject: [ConfigService],
      connectionName: 'authConnection',
    }),

    // Redis cache config (phải async)
    CacheModule.register({
      isGlobal: true,
      // @ts-ignore
      store: new KeyvRedis('rediss://red-d071mk9r0fns7383v3j0:DeNbSrFT3rDj2vhGDGoX4Pr2DgHUBP8H@singapore-keyvalue.render.com:6379'),
      ttl: 3600 * 1000,
    }),

    // Microservice client
    ClientsModule.register([
      // {
      //   name: 'USERS_CLIENT',
      //   transport: Transport.TCP,
      //   options: {
      //     port: 3001,
      //   },
      // },
      {
        name: 'ADMIN_CLIENT',
        transport: Transport.TCP,
        options: {
          host: 'localhost',
          port: 3010
        }
      }
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, CacheService],
})
export class AuthModule { }
