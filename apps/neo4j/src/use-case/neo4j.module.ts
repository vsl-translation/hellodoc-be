import { Module } from '@nestjs/common';
import { Neo4jController } from '../controller/neo4j.controller';
import { Neo4jService } from '../service/neo4j.service';

@Module({
  controllers: [Neo4jController],
  providers: [Neo4jService],
})
export class Neo4jModule {}
