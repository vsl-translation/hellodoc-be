import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Neo4jController } from '../controller/neo4j.controller';
import { Neo4jService } from '../services/neo4j-client.service';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'NEO4J_CLIENT',
                transport: Transport.TCP,
                options: {
                    host: 'localhost',  // host microservice Neo4j
                    port: 3008,         // port microservice Neo4j
                },
            },
        ]),
    ],
    controllers: [Neo4jController],
    providers: [Neo4jService],
})
export class Neo4jModule {}
