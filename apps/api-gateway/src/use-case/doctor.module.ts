import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { DoctorController } from '../controller/doctor.controller';
import { DoctorService } from '../services/doctor.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

@Module({
    imports: [
        HttpModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                timeout: 5000,
                maxRedirects: 5,
                baseURL: configService.get('DOCTORS_SERVICE_URL') || 'http://localhost:3003',
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [DoctorController],
    providers: [DoctorService],
})
export class DoctorModule { }
