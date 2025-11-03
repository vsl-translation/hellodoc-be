import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { DoctorController } from '../controller/doctor.controller';
import { DoctorService } from '../services/doctor.service';

@Module({
    imports: [
        //ket noi gateway voi users service (ket noi dung giao thuc va port)
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
    controllers: [DoctorController],
    providers: [DoctorService],
})
export class DoctorModule { }
