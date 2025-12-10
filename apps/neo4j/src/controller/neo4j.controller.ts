import { Body, Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Neo4jService } from '../service/neo4j.service';
import { CreateNodeDto } from '../core/dto/createNode.dto';
import { CreateRelationDto } from '../core/dto/createRelation.dto';

@Controller()
export class Neo4jController {
  constructor(private readonly neo4jService: Neo4jService) { }

  @MessagePattern('neo4j.create-node')
  async createNode(@Body() dto: CreateNodeDto) {
    return this.neo4jService.createNode(dto);
  }

  @MessagePattern('neo4j.create-relation')
  async createRelation(@Body() dto: CreateRelationDto) {
    return this.neo4jService.createRelation(dto);
  }

  @MessagePattern('neo4j.get-suggestions')
  async getSuggestions(@Body('word') word: string) {
    return this.neo4jService.getSuggestions(word);
  }

  @MessagePattern('neo4j.get-relation')
  async getRelation(@Payload() payload: { fromLabel: string; fromName: string; toLabel: string; toName: string; relationType: string }) {
    return this.neo4jService.getRelation(
      payload.fromLabel,
      payload.fromName,
      payload.toLabel,
      payload.toName,
      payload.relationType,
    );
  }

  @MessagePattern('neo4j.find-word-by-label')
  async getNodeByLabel(@Payload() payload: {word: string, toLabel: string}) {
    return this.neo4jService.getSuggestionsByLabel(payload.word,  payload.toLabel);
  }

  @MessagePattern('neo4j.get-all')
  async getAll() {
    return this.neo4jService.getAll();
  }

  @MessagePattern('neo4j.delete-all')
  async deleteAll() {
    return this.neo4jService.deleteAll();
  }

  @MessagePattern('neo4j.delete-node')
  async deleteNode(@Payload() payload: { label: string; name: string }) {
    return this.neo4jService.deleteNode(payload.label, payload.name);
  }

  @MessagePattern('neo4j.delete-node-by-id')
  async deleteNodeById(id: string) {
    return this.neo4jService.deleteNodeById(id);
  }

  @MessagePattern('neo4j.delete-relation')
  async deleteRelation(@Payload() payload: { fromLabel: string; fromName: string; toLabel: string; toName: string; relationType: string }) {
    return this.neo4jService.deleteRelation(
      payload.fromLabel,
      payload.fromName,
      payload.toLabel,
      payload.toName,
      payload.relationType,
    );
  }

  @MessagePattern('neo4j.get-relations-from-node')
  async getRelationsFromNode(@Payload() payload: { label: string; name: string }) {
    return this.neo4jService.getRelationsFromNode(payload.label, payload.name);
  }

  @MessagePattern('neo4j.batch-update-weights')
  async batchUpdateWeights(@Payload() relations: { fromLabel: string; fromName: string; toLabel: string; toName: string; relationType: string; weight: number }[]) {
    return this.neo4jService.batchUpdateWeights(relations);
  }

  @MessagePattern('neo4j.get-all-relations')
  async getAllRelations() {
    return this.neo4jService.getAllRelations();
  }

  @MessagePattern('neo4j.get-relations-to-node')
  async getRelationsToNode(@Payload() payload: { label: string; name: string }) {
    return this.neo4jService.getRelationsToNode(payload.label, payload.name);
  }

}
