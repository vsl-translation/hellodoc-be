import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Admin, AdminSchema } from '../core/schema/admin.schema';
import { AdminController } from '../controller/admin.controller';
import { AdminService } from '../service/admin.service';
import { MediaUrlHelper } from 'libs/media-url.helper';
import { JWT } from 'google-auth-library';
import { JwtModule } from '@nestjs/jwt';
// import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),

    //khai bao ket noi voi mongodb
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const isDev = configService.get<string>('isDev') === 'true';
        const uri = isDev
          ? configService.get<string>('MONGO_URI_DEV')
          : configService.get<string>('MONGO_URI_ADMIN');

        return { uri };
      },
      inject: [ConfigService],
      connectionName: 'adminConnection',
    }),
    // JWT cấu hình global
    JwtModule.register({
      global: true,
      secret: 'secretKey',
      signOptions: { expiresIn: '24h' },
    }),

    //khai bao model cho USER
    MongooseModule.forFeature(
      [{ name: Admin.name, schema: AdminSchema }],
      'adminConnection',
    ),

    ClientsModule.register([
      {
        name: 'DOCTOR_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3003,
        },
      },
      {
        name: 'MEDIA_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3006,
        },
      },
      {
        name: 'USERS_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3001,
        },
      },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, MediaUrlHelper],
})
export class AdminModule { }
