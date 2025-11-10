import { Injectable, Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { AppointmentController } from "../controller/appointment.controller";
import { AppointmentService } from "../services/appointment.service";

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'APPOINTMENT_CLIENT',
                transport: Transport.TCP,
                options: {
                    host: 'localhost',
                    port: 3007
                }
            }
        ])
    ],
    controllers: [AppointmentController],
    providers: [AppointmentService],
})

export class AppointmentModule { }