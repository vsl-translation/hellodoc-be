import { Module } from '@nestjs/common';
import { NlpIntegrationController } from '../controller/nlp-integration.controller';
import { NlpIntegrationService } from '../service/nlp-integration.service';
import config from 'apps/config/config';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),
    ClientsModule.register([
      {
        name: 'UNDERTHESEA_CLIENT',
        transport: Transport.TCP,
        options: {
          port: 3020,
        },
      },
      {
        name: 'NEO4J_CLIENT',
        transport: Transport.TCP,
        options: {
          host: 'localhost',  // host microservice Neo4j
          port: 3008,         // port microservice Neo4j
        },
      },
      {
        name: 'QDRANT_CLIENT',
        transport: Transport.TCP,
        options: {
          host: 'localhost',  // host microservice Word Embedding
          port: 3013,         // port microservice Word Embedding
        },
      },
      {
        name: 'EMBEDDING_CLIENT',
        transport: Transport.TCP,
        options: {
          host: 'localhost',  // host microservice Word Embedding
          port: 3012,         // port microservice Word Embedding
        },
      }
    ]),
  ],
  controllers: [NlpIntegrationController],
  providers: [NlpIntegrationService],
})
export class NlpIntegrationModule { }
