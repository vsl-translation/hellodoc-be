import { Injectable, Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { MediaController } from "../controller/media.controller";
import { MediaService } from "../services/media.service";

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'MEDIA_CLIENT',
                transport: Transport.TCP,
                options: {
                    host: 'localhost',
                    port: 3006
                }
            }
        ])
    ],
    controllers: [MediaController],
    providers: [MediaService],
})

export class MediaModule { }