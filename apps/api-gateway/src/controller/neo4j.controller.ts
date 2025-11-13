import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Neo4jService } from '../services/neo4j-client.service';
import { CreateNodeDto } from 'apps/neo4j/src/core/dto/createNode.dto';
import { CreateRelationDto } from 'apps/neo4j/src/core/dto/createRelation.dto';

@Controller('neo4j')
export class Neo4jController {
    constructor(private readonly neo4jService: Neo4jService) {}

    @Post('node')
    createNode(@Body() dto: CreateNodeDto) {
        return this.neo4jService.createNode(dto);
    }

    @Post('relation')
    createRelation(@Body() dto: CreateRelationDto) {
        return this.neo4jService.createRelation(dto);
    }

    @Get('suggestions/:word')
    getSuggestions(@Param('word') word: string) {
        return this.neo4jService.getSuggestions(word);
    }

    @Get('all')
    getAll() {
        return this.neo4jService.getAll();
    }
}
