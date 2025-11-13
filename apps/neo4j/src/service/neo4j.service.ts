import { Injectable, InternalServerErrorException } from '@nestjs/common';
import neo4j, { Driver, Session } from 'neo4j-driver';
import { CreateNodeDto } from '../core/dto/createNode.dto';
import { CreateRelationDto } from '../core/dto/createRelation.dto';

@Injectable()
export class Neo4jService {
  private driver: Driver;

  constructor() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URI || 'bolt://localhost:7687',
      neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password')
    );
  }

  private getSession(): Session {
    return this.driver.session();
  }

  async createNode(dto: CreateNodeDto) {
    const session = this.getSession();
    try {
      const query = `
        MERGE (n:${dto.label} {name: $name})
        RETURN n
      `;
      const result = await session.run(query, { name: dto.name });
      return result.records[0]?.get('n').properties;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi tạo node');
    } finally {
      await session.close();
    }
  }

  async createRelation(dto: CreateRelationDto) {
    const session = this.getSession();
    try {
      const query = `
        MATCH (a:${dto.fromLabel} {name: $fromName})
        MATCH (b:${dto.toLabel} {name: $toName})
        MERGE (a)-[r:${dto.relationType}]->(b)
        RETURN type(r)
      `;
      const result = await session.run(query, {
        fromName: dto.fromName,
        toName: dto.toName
      });
      return { relation: result.records[0]?.get('type(r)') };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi tạo quan hệ');
    } finally {
      await session.close();
    }
  }

  async getSuggestions(word: string) {
    const session = this.getSession();
    try {
      const query = `
        MATCH (a {name: $word})-[:RELATES_TO]->(b)
        RETURN b.name AS suggestion
      `;
      const result = await session.run(query, { word });
      return result.records.map(r => r.get('suggestion'));
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi truy vấn gợi ý');
    } finally {
      await session.close();
    }
  }
}
