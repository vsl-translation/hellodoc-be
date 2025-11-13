import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SpecialtyController } from '../controller/specialty.controller';
import { SpecialtyService } from '../services/specialty.service';

@Module({
    imports: [
        //ket noi gateway voi users service (ket noi dung giao thuc va port)
        ClientsModule.register([
            {
                name: 'SPECIALTY_CLIENT',
                transport: Transport.TCP,
                options: {
                    port: 3009,
                },
            },
        ]),
    ],
    controllers: [SpecialtyController],
    providers: [SpecialtyService],
})
export class SpecialtyModule { }
