import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { Driver, Session } from 'neo4j-driver';
import { CreateNodeDto } from '../core/dto/createNode.dto';
import { CreateRelationDto } from '../core/dto/createRelation.dto';
@Injectable()
export class Neo4jService {
  private driver: Driver;

  constructor() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URI || 'neo4j://localhost:7687',
      neo4j.auth.basic(
        process.env.NEO4J_USERNAME || 'neo4j',
        process.env.NEO4J_PASSWORD || 'password',
      ),
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
        MERGE (a:${dto.fromLabel} {name: $fromName})
        MERGE (b:${dto.toLabel} {name: $toName})
        MERGE (a)-[r:${dto.relationType}]->(b)
        SET r.weight = coalesce(r.weight, 0) + coalesce($weight, 0)
        RETURN a, r, b
      `;
      const result = await session.run(query, {
        fromName: dto.fromName,
        toName: dto.toName,
        weight: dto.weight ?? 1, // mặc định weight = 1 nếu không truyền
      });

      const record = result.records[0];
      return {
        from: record.get('a').properties,
        relation: record.get('r').type,
        weight: record.get('r').properties.weight,
        to: record.get('b').properties,
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi tạo quan hệ');
    } finally {
      await session.close();
    }
  }


  async getSuggestions(word: string) {
    const session = this.getSession();
    console.log('Finding word:', word);

    //Lowercase the word for case-insensitive matching
    word = word.toLowerCase();

    try {
      const query = `
        MATCH (a {name: $word})-
        [r]->(b)
        RETURN b.name AS suggestion, r.weight AS score, labels(b) AS label
        ORDER BY r.weight DESC;
      `;

      const result = await session.run(query, { word });
      console.log('Suggestion query result:', result.records);

      return result.records.map(r => ({
        suggestion: r.get('suggestion'),
        score: r.get('score'),
        label: r.get('label'),     // labels(b) là 1 mảng
      }));

    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi truy vấn gợi ý');
    } finally {
      await session.close();
    }
  }

  async getSuggestionsByLabel(
    word: string,
    toLabel: string
  ) {
    const session = this.getSession();
    try {
      const upperToLabel = toLabel.toUpperCase();

      // Bước 1: Thử lấy 10 nút liền kề với word
      const adjacentQuery = `
        MATCH (a)--(b)
        WHERE 
          a.name = $word
          AND $toLabel IN labels(b)
        RETURN 
          b.name AS suggestion, 
          1.0 AS score,
          labels(b) AS label
        LIMIT 10
      `;

      const adjacentResult = await session.run(adjacentQuery, {
        word: word,
        toLabel: upperToLabel
      });

      // Nếu có kết quả từ nút liền kề, trả về luôn
      if (adjacentResult.records.length > 0) {
        return adjacentResult.records.map(r => ({
          suggestion: r.get('suggestion'),
          score: r.get('score'),
          label: r.get('label')
        }));
      }

      // Bước 2: Nếu rỗng, lấy 10 nút bất kỳ có label
      const fallbackQuery = `
        MATCH (b)
        WHERE 
          $toLabel IN labels(b)
        RETURN 
          b.name AS suggestion, 
          1.0 AS score,
          labels(b) AS label
        ORDER BY score DESC
        LIMIT 10
      `;

      const fallbackResult = await session.run(fallbackQuery, {
        toLabel: upperToLabel
      });

      return fallbackResult.records.map(r => ({
        suggestion: r.get('suggestion'),
        score: r.get('score'),
        label: r.get('label')
      }));

    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Lỗi khi truy vấn gợi ý theo label'
      );
    } finally {
      await session.close();
    }
  }
  async updateRelationWeight(data: {
    fromLabel: string;
    fromName: string;
    toLabel: string;
    toName: string;
    relationType: string;
    weight: number;
  }) {
    const session = this.getSession();
    try {
      const query = `
        MATCH (from:${data.fromLabel} {name: $fromName})-[r:${data.relationType}]->(to:${data.toLabel} {name: $toName})
        SET r.weight = $weight
        RETURN r
      `;

      await session.run(query, {
        fromName: data.fromName,
        toName: data.toName,
        weight: data.weight,
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Lỗi khi update relation weight:', error);
      throw new InternalServerErrorException('Lỗi khi update relation weight');
    } finally {
      await session.close();
    }
  }

  async getAll() {
    const session = this.getSession();
    try {
      console.log('Fetching entire graph...');

      // --- SỬA Ở ĐÂY ---
      // Thay vì RETURN p, hãy RETURN n, r, m rõ ràng
      // Sử dụng OPTIONAL MATCH để lấy cả những node đứng một mình (nếu muốn)
      // Hoặc dùng MATCH (n)-[r]->(m) nếu chỉ muốn lấy các node có liên kết

      const query = `
        MATCH (n)-[r]->(m)
        RETURN n, r, m
        LIMIT 1000 
      `;
      // Lưu ý: Thêm LIMIT để tránh treo server nếu DB quá lớn

      const result = await session.run(query);

      const nodesMap = new Map();
      const relationships: any[] = [];

      for (const record of result.records) {
        // Bây giờ record đã có các key này
        const n = record.get('n');
        const r = record.get('r');
        const m = record.get('m');

        // ===== NODE N =====
        if (n) {
          const label = n.labels ? n.labels[0] : 'Unknown'; // Safety check
          const name = n.properties.name || 'NoName';
          const nodeId = `${label}:${name}`;

          if (!nodesMap.has(nodeId)) { // Check trùng để tối ưu
            nodesMap.set(nodeId, {
              id: nodeId,
              labels: n.labels,
              properties: n.properties
            });
          }
        }

        // ===== NODE M =====
        if (m) {
          const label = m.labels ? m.labels[0] : 'Unknown';
          const name = m.properties.name || 'NoName';
          const nodeId = `${label}:${name}`;

          if (!nodesMap.has(nodeId)) {
            nodesMap.set(nodeId, {
              id: nodeId,
              labels: m.labels,
              properties: m.properties
            });
          }
        }

        // ===== RELATION =====
        if (r && n && m) {
          relationships.push({
            id: `${r.type}-${n.properties.name}->${m.properties.name}`,
            type: r.type,
            start: `${n.labels[0]}:${n.properties.name}`,
            end: `${m.labels[0]}:${m.properties.name}`,
            properties: r.properties || {}
          });
        }
      }
      console.log('Returning full graph with nodes/relationships:', nodesMap.size, relationships.length);

      return {
        nodes: Array.from(nodesMap.values()),
        relationships
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi lấy toàn bộ graph');
    } finally {
      await session.close();
    }
  }
  async deleteAll() {
    const session = this.getSession();
    try {
      const query = `MATCH (n) DETACH DELETE n`;
      await session.run(query);
      return { message: 'Đã xóa toàn bộ dữ liệu' };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Không thể xóa dữ liệu');
    } finally {
      await session.close();
    }
  }

  async deleteAllRelations() {
    const session = this.getSession();
    try {
      const query = `MATCH ()-[r]->() DELETE r`;
      await session.run(query);
      return { message: 'Đã xóa toàn bộ relation' };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Không thể xóa relation');
    } finally {
      await session.close();
    }
  }

  /** Xóa node theo label và name */
  async deleteNode(label: string, name: string) {
    const session = this.getSession();
    try {
      const query = `
        MATCH (n:${label} {name: $name})
        DETACH DELETE n
        RETURN COUNT(n) AS deletedCount
      `;
      const result = await session.run(query, { name });
      return { deletedCount: result.records[0].get('deletedCount').toNumber() };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi xóa node');
    } finally {
      await session.close();
    }
  }

  // xóa node theo id
  async deleteNodeById(id: string) {
    const session = this.getSession();
    try {
      const query = `
        MATCH (n)
        WHERE id(n) = $id
        DETACH DELETE n
        RETURN COUNT(n) AS deletedCount
      `;
      const result = await session.run(query, { id });
      return { deletedCount: result.records[0].get('deletedCount').toNumber() };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi xóa node');
    } finally {
      await session.close();
    }
  }

  /** Xóa relationship giữa 2 node */
  async deleteRelation(fromLabel: string, fromName: string, toLabel: string, toName: string, relationType: string) {
    const session = this.getSession();
    try {
      const query = `
        MATCH (a:${fromLabel} {name: $fromName})-[r:${relationType}]->(b:${toLabel} {name: $toName})
        DELETE r
        RETURN COUNT(r) AS deletedCount
      `;
      const result = await session.run(query, { fromName, toName });
      return { deletedCount: result.records[0].get('deletedCount').toNumber() };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi xóa quan hệ');
    } finally {
      await session.close();
    }
  }

  async getRelationsFromNode(label: string, name: string) {
    const session = this.getSession();
    try {
      const query = `
        MATCH (a:${label} {name: $name})-[r]->(b)
        RETURN type(r) AS relationType, b.name AS toName, labels(b) AS toLabels, r.weight AS weight
      `;
      const result = await session.run(query, { name });
      return result.records.map(record => ({
        relationType: record.get('relationType'),
        toName: record.get('toName'),
        toLabels: record.get('toLabels'),
        weight: record.get('weight'),
      }));
    }
    catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi truy vấn quan hệ từ node');
    }
    finally {
      await session.close();
    }
  }

  // ========== SỬA batchUpdateWeights() - CHUẨN HÓA WEIGHT TYPE ==========
  async batchUpdateWeights(relations: {
    fromLabel: string;
    fromName: string;
    toLabel: string;
    toName: string;
    relationType: string;
    weight: number
  }[]) {
    const session = this.getSession();
    const tx = session.beginTransaction();
    try {
      console.log(`🔄 Batch updating ${relations.length} relations...`);

      // ✅ Đơn giản hóa - Neo4j tự convert number sang float
      const normalizedRelations = relations.map(rel => ({
        ...rel,
        weight: Number(rel.weight.toFixed(6)) // Đảm bảo là number thuần túy
      }));

      const query = `
      UNWIND $relations AS rel
      MATCH (a {name: rel.fromName})-[r]->(b {name: rel.toName})
      WHERE rel.fromLabel IN labels(a) 
        AND rel.toLabel IN labels(b)
        AND type(r) = rel.relationType
      SET r.weight = toFloat(rel.weight)
      RETURN count(r) as updated
    `;

      const result = await tx.run(query, { relations: normalizedRelations });
      await tx.commit();

      const updatedCount = result.records[0]?.get('updated')?.toNumber() || 0;

      console.log(`✅ Successfully updated ${updatedCount} relations`);

      // ⚠️ WARNING nếu số lượng không khớp
      if (updatedCount !== relations.length) {
        console.warn(`⚠️  Expected ${relations.length} updates, but only ${updatedCount} were successful`);
      }

      return {
        message: 'Cập nhật weight thành công',
        requested: relations.length,
        updated: updatedCount
      };
    } catch (error) {
      await tx.rollback();
      console.error('❌ Lỗi khi cập nhật weight:', error);
      throw new InternalServerErrorException('Lỗi khi cập nhật weight');
    } finally {
      await session.close();
    }
  }
  // ========== SỬA getAllRelations() - THÊM LABELS ==========
  async getAllRelations() {
    const session = this.getSession();
    try {
      const query = `
        MATCH (a)-[r]->(b)
        RETURN 
          a.name AS fromName, 
          labels(a) AS fromLabels,  // ✅ THÊM labels của node nguồn
          b.name AS toName, 
          labels(b) AS toLabels,    // ✅ THÊM labels của node đích
          type(r) AS relationType, 
          r.weight AS weight
      `;
      const result = await session.run(query);
      return result.records.map(record => {
        const fromLabels = record.get('fromLabels');
        const toLabels = record.get('toLabels');

        return {
          fromName: record.get('fromName'),
          fromLabel: fromLabels[0], // ✅ Lấy label đầu tiên
          toName: record.get('toName'),
          toLabel: toLabels[0],     // ✅ Lấy label đầu tiên
          relationType: record.get('relationType'),
          weight: record.get('weight'),
        };
      });
    }
    catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi lấy tất cả quan hệ');
    }
    finally {
      await session.close();
    }
  }


  async getRelationsToNode(label: string, name: string) {
    const session = this.getSession();
    try {
      const query = `
        MATCH (a)-[r]->(b:${label} {name: $name})
        RETURN type(r) AS relationType, a.name AS fromName, labels(a) AS fromLabels, r.weight AS weight
      `;
      const result = await session.run(query, { name });
      return result.records.map(record => ({
        relationType: record.get('relationType'),
        fromName: record.get('fromName'),
        fromLabels: record.get('fromLabels'),
        weight: record.get('weight'),
      }));
    }
    catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi truy vấn quan hệ đến node');
    }
    finally {
      await session.close();
    }
  }

  async getRelation(fromLabel: string, fromName: string, toLabel: string, toName: string, relationType: string) {
    const session = this.getSession();
    try {
      console.log('Getting relation:', { fromLabel, fromName, toLabel, toName, relationType });
      const query = `
        MATCH (a:${fromLabel} {name: $fromName})-[r:${relationType}]->(b:${toLabel} {name: $toName})
        RETURN r
      `;
      const result = await session.run(query, { fromName, toName });
      if (result.records.length === 0) {
        return null;
      }
      const record = result.records[0];
      return {
        relation: record.get('r').type,
        weight: record.get('r').properties.weight,
      };
    }
    catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi truy vấn quan hệ');
    }
    finally {
      await session.close();
    }
  }

  /**
 * Lấy tất cả các node theo label
 */
  async getNodesByLabel(label: string) {
    const session = this.getSession();
    try {
      const query = `
      MATCH (n:${label})
      RETURN n.name AS name, labels(n) AS labels, n AS node
      ORDER BY n.name
    `;
      const result = await session.run(query);

      return result.records.map(record => ({
        name: record.get('name'),
        labels: record.get('labels'),
        properties: record.get('node').properties,
      }));
    } catch (error) {
      console.error(`Lỗi khi lấy nodes với label ${label}:`, error);
      throw new InternalServerErrorException(`Lỗi khi lấy nodes với label ${label}`);
    } finally {
      await session.close();
    }
  }

  /**
   * Đếm số lượng node theo label
   */
  async countNodesByLabel(label: string) {
    const session = this.getSession();
    try {
      const query = `
      MATCH (n:${label})
      RETURN count(n) AS total
    `;
      const result = await session.run(query);
      return result.records[0]?.get('total')?.toNumber() || 0;
    } catch (error) {
      console.error(`Lỗi khi đếm nodes với label ${label}:`, error);
      throw new InternalServerErrorException(`Lỗi khi đếm nodes với label ${label}`);
    } finally {
      await session.close();
    }
  }

  /**
   * Xóa nhiều nodes theo label và danh sách tên
   */
  async deleteNodesBatch(label: string, names: string[]) {
    const session = this.getSession();
    const tx = session.beginTransaction();

    try {
      console.log(`🗑️  Đang xóa ${names.length} nodes với label "${label}"...`);

      const query = `
      UNWIND $names AS nodeName
      MATCH (n:${label} {name: nodeName})
      DETACH DELETE n
      RETURN count(n) AS deletedCount
    `;

      const result = await tx.run(query, { names });
      await tx.commit();

      const deletedCount = result.records[0]?.get('deletedCount')?.toNumber() || 0;

      console.log(`✅ Đã xóa ${deletedCount} nodes`);

      return {
        deletedCount,
        requested: names.length,
        success: deletedCount === names.length
      };
    } catch (error) {
      await tx.rollback();
      console.error('❌ Lỗi khi xóa batch nodes:', error);
      throw new InternalServerErrorException('Lỗi khi xóa batch nodes');
    } finally {
      await session.close();
    }
  }

  /**
   * Kiểm tra node có tồn tại không
   */
  async nodeExists(label: string, name: string): Promise<boolean> {
    const session = this.getSession();
    try {
      const query = `
      MATCH (n:${label} {name: $name})
      RETURN count(n) > 0 AS exists
    `;
      const result = await session.run(query, { name });
      return result.records[0]?.get('exists') || false;
    } catch (error) {
      console.error('Lỗi khi kiểm tra node:', error);
      return false;
    } finally {
      await session.close();
    }
  }

  /**
 * Lấy node theo label và name
 */
  async getNode(label: string, name: string): Promise<any> {
    const session = this.getSession();
    try {
      console.log(`📝 Getting node: ${label}:${name}`);

      const query = `
        MATCH (n:${label} {name: $name})
        RETURN n, labels(n) as labels
      `;

      const result = await session.run(query, { name });

      if (result.records.length === 0) {
        console.log(`⚠️ Node không tồn tại: ${label}:${name}`);
        return null;
      }

      const record = result.records[0];
      const node = record.get('n');
      const labels = record.get('labels');

      const nodeData = {
        id: node.identity.toString(),
        labels: labels,
        label: label,
        name: node.properties.name,
        properties: node.properties,
      };

      console.log(`✅ Tìm thấy node:`, nodeData);
      return nodeData;

    } catch (error) {
      console.error(`❌ Lỗi khi lấy node ${label}:${name}:`, error);
      throw new InternalServerErrorException(`Lỗi khi lấy node: ${error.message}`);
    } finally {
      await session.close();
    }
  }

  /**
   * Cập nhật properties của node
   */
  async updateNodeProperties(
    label: string,
    name: string,
    properties: Record<string, any>
  ): Promise<any> {
    const session = this.getSession();
    try {
      console.log(`📝 Updating node properties: ${label}:${name}`, properties);

      // Tạo chuỗi SET clause
      const setClauses = Object.keys(properties)
        .map(key => `n.${key} = $properties.${key}`)
        .join(', ');

      const query = `
        MATCH (n:${label} {name: $name})
        SET ${setClauses}
        RETURN n, labels(n) as labels
      `;

      const result = await session.run(query, {
        name,
        properties
      });

      if (result.records.length === 0) {
        console.log(`⚠️ Node không tồn tại để cập nhật: ${label}:${name}`);

        // Fallback: Tạo node mới nếu không tồn tại
        const createQuery = `
          CREATE (n:${label} {name: $name})
          SET n += $properties
          RETURN n, labels(n) as labels
        `;

        const createResult = await session.run(createQuery, {
          name,
          properties
        });

        const createdNode = createResult.records[0].get('n');
        const createdLabels = createResult.records[0].get('labels');

        return {
          id: createdNode.identity.toString(),
          labels: createdLabels,
          label: label,
          name: createdNode.properties.name,
          properties: createdNode.properties,
          wasCreated: true,
        };
      }

      const record = result.records[0];
      const node = record.get('n');
      const labels = record.get('labels');

      const updatedNode = {
        id: node.identity.toString(),
        labels: labels,
        label: label,
        name: node.properties.name,
        properties: node.properties,
        wasCreated: false,
      };

      console.log(`✅ Đã cập nhật node:`, updatedNode);
      return updatedNode;

    } catch (error) {
      console.error(`❌ Lỗi khi cập nhật node properties ${label}:${name}:`, error);
      throw new InternalServerErrorException(`Lỗi khi cập nhật node: ${error.message}`);
    } finally {
      await session.close();
    }
  }
}
