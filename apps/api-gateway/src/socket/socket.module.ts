import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { AuthModule } from '../use-case/auth.module';
import Redis from 'ioredis';

@Module({
  imports: [AuthModule],
  providers: [
    SocketGateway,
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        return new Redis('rediss://red-d071mk9r0fns7383v3j0:DeNbSrFT3rDj2vhGDGoX4Pr2DgHUBP8H@singapore-keyvalue.render.com:6379');
      },
    },
  ],
  exports: [SocketGateway],
})
export class SocketModule {}
