import { Module } from '@nestjs/common';
import { UsersController } from '../controller/users.controller';
import { UsersService } from '../service/users.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../core/schema/user.schema';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from 'apps/config/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

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
          : configService.get<string>('MONGO_URI_PROD');

        return { uri };
      },
      inject: [ConfigService],
      connectionName: 'userConnection',
    }),

    //khai bao model cho USER
    MongooseModule.forFeature(
      [{ name: User.name, schema: UserSchema }],
      'userConnection',
    ),

    //ket noi voi doctor service
    ClientsModule.register([
      {
        name: 'DOCTOR_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3003,
        },
      },
    ]),

  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule { }
