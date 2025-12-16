import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PhowhisperController } from '../controller/phowhisper.controller';
import { PhowhisperService } from '../services/phowhisper.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'PHOWHISPER_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3024,
        },
      },
    ]),
  ],
  controllers: [PhowhisperController],
  providers: [PhowhisperService],
})
export class PhowhisperModule {}