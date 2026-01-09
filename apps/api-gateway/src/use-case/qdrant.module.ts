import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { QdrantController } from '../controller/qdrant.controller';
import { QdrantService } from '../services/qdrant.service';

@Module({
    imports: [
        //ket noi gateway voi users service (ket noi dung giao thuc va port)
        ClientsModule.register([
            {
                name: 'QDRANT_CLIENT',
                transport: Transport.TCP,
                options: {
                    port: 3013,
                },
            },
        ]),
    ],
    controllers: [QdrantController],
    providers: [QdrantService],
})
export class QdrantModule { }
