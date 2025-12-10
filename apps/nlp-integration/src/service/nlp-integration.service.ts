import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

  import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
// Mapping POS tags sang tên đầy đủ và loại quan hệ
const POS_TAG_INFO = {
  // Danh từ
  'N': { fullName: 'Noun', vnName: 'Danh từ' },
  'Np': { fullName: 'Proper Noun', vnName: 'Danh từ riêng' },
  'Nc': { fullName: 'Noun Category', vnName: 'Danh từ chỉ loại' },
  'Nu': { fullName: 'Noun Unit', vnName: 'Danh từ đơn vị' },
  'Ny': { fullName: 'Noun Abbreviation', vnName: 'Danh từ viết tắt' },
  'Nb': { fullName: 'Borrowed Noun', vnName: 'Danh từ mượn' },
  
  //Chủ từ
  'P': { fullName: 'Pronoun', vnName: 'Đại từ' },

  // Động từ
  'V': { fullName: 'Verb', vnName: 'Động từ' },
  'Vb': { fullName: 'Borrowed Verb', vnName: 'Động từ mượn' },
  'Vy': { fullName: 'Verb Abbreviation', vnName: 'Động từ viết tắt' },

  // Tính từ
  'A': { fullName: 'Adjective', vnName: 'Tính từ' },
  'Ab': { fullName: 'Borrowed Adjective', vnName: 'Tính từ mượn' },

  // Các loại từ khác
  'R': { fullName: 'Adverb', vnName: 'Phó từ' },
  'L': { fullName: 'Determiner', vnName: 'Định từ' },
  'M': { fullName: 'Numeral', vnName: 'Số từ' },
  'E': { fullName: 'Adposition', vnName: 'Giới từ' },
  'C': { fullName: 'Coordinating Conjunction', vnName: 'Liên từ' },
  'Cc': { fullName: 'Subordinating Conjunction', vnName: 'Liên từ đẳng lập' },
  'I': { fullName: 'Interjection', vnName: 'Thán từ' },
  'T': { fullName: 'Particle', vnName: 'Trợ từ' },
  'B': { fullName: 'Borrow', vnName: 'Từ mượn' },
  'FW': { fullName: 'Foreign Word', vnName: 'Từ nước ngoài' },
  'CH': { fullName: 'Chunk', vnName: 'Dấu câu' },
  'X': { fullName: 'Unknown', vnName: 'Không phân loại' },
  'Z': { fullName: 'Complex Word', vnName: 'Yếu tố cấu tạo từ' },
  'S': { fullName: 'School/Organization', vnName: 'Tên trường/tổ chức' },
  'Y': { fullName: 'Unknown Y', vnName: 'Loại Y' },
};

@Injectable()
export class NlpIntegrationService {
  constructor(
    @Inject('UNDERTHESEA_CLIENT') private readonly undertheseaClient: ClientProxy,
    @Inject('NEO4J_CLIENT') private readonly neo4jClient: ClientProxy,
  ) { }

  /*
   Phân tích văn bản và tạo graph trong Neo4j
   @param text - Văn bản cần phân tích
   @param createRelations - Có tạo quan hệ giữa các từ liên tiếp không
   */
  async analyzeAndCreateGraph(text: string, createRelations: boolean = true) {
    try {
      console.log('=== BẮT ĐẦU PHÂN TÍCH ===');
      console.log('Text:', text);
      console.log('Create Relations:', createRelations);

      // Bước 1: Phân tích POS
      console.log('Đang gọi underthesea.pos...');
      const posResult = await firstValueFrom(
        this.undertheseaClient.send('underthesea.pos', { text: text })
      );

      console.log('POS Result:', JSON.stringify(posResult, null, 2));

      if (!posResult || !posResult.success) {
        console.error('POS analysis failed:', posResult);
        throw new InternalServerErrorException('Không thể phân tích POS');
      }

      const { tokens, pos_tags } = posResult;
      console.log('Tokens:', tokens);
      console.log('POS Tags:', pos_tags);

      if (!tokens || !pos_tags || tokens.length === 0) {
        throw new InternalServerErrorException('POS result không có dữ liệu');
      }

      // ✅ Danh sách đầy đủ các đại từ nhân xưng và xưng hô trong tiếng Việt
      const PRONOUNS = new Set([
        // Đại từ ngôi thứ nhất
        'tôi', 'tui', 'tao', 'tớ', 'mình', 'chúng tôi', 'chúng ta', 'chúng mình',
        
        // Đại từ ngôi thứ hai
        'bạn', 'mày', 'cậu', 'các bạn', 'quý vị',
        
        // Đại từ ngôi thứ ba
        'họ', 'nó', 'hắn', 'y', 'chúng nó',
        
        // Đại từ xưng hô gia đình/thân tộc
        'anh', 'chị', 'em', 'ông', 'bà', 'cháu',
        'bố', 'ba', 'tía', 'con', 'mẹ', 'má',
        'chú', 'bác', 'cô', 'dì'
      ]);

      // Trích xuất POS tag và override cho đại từ nhân xưng
      const extractedPosTags = pos_tags.map((item, index) => {
        let posTag;
        
        // Lấy POS tag từ mảng 2 chiều hoặc string
        if (Array.isArray(item)) {
          posTag = item[1]; // Lấy phần tử thứ 2 (POS tag)
        } else {
          posTag = item; // Nếu đã là string thì giữ nguyên
        }
        
        // ✅ Kiểm tra nếu token là đại từ nhân xưng → gán label "P"
        const currentToken = tokens[index].toLowerCase();
        if (PRONOUNS.has(currentToken)) {
          console.log(`Token "${tokens[index]}" được nhận dạng là đại từ nhân xưng → Label: P`);
          return 'P';
        }
        
        return posTag;
      });

      console.log('Extracted POS Tags:', extractedPosTags);

      const createdNodes = [];
      const createdRelations = [];

      // Bước 2: Tạo nodes cho mỗi token
      console.log('=== BẮT ĐẦU TẠO NODES ===');
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const posTag = extractedPosTags[i];

        console.log(`Đang tạo node ${i + 1}/${tokens.length}: "${token}" (${posTag})`);

        try {
          const nodePayload = {
            label: posTag,
            name: token,
          };
          console.log('Node payload:', nodePayload);

          const node = await firstValueFrom(
            this.neo4jClient.send('neo4j.create-node', nodePayload)
          );

          console.log('Node created:', node);

          createdNodes.push({
            token,
            posTag,
            posInfo: this.getPosTagInfo(posTag),
            node,
          });
        } catch (error) {
          console.error(`LỖI tạo node cho token "${token}":`, error);
          console.error('Error stack:', error.stack);
          throw error;
        }
      }

      console.log(`Đã tạo ${createdNodes.length} nodes`);

      // Bước 3: Tạo relations giữa các từ liên tiếp
      if (createRelations && tokens.length > 1) {
        console.log('=== BẮT ĐẦU TẠO RELATIONS ===');
        for (let i = 0; i < tokens.length - 1; i++) {
          console.log(`Tạo relation ${i + 1}/${tokens.length - 1}: "${tokens[i]}" -> "${tokens[i + 1]}"`);

          try {
            const relationPayload = {
              fromLabel: extractedPosTags[i],
              fromName: tokens[i],
              toLabel: extractedPosTags[i + 1],
              toName: tokens[i + 1],
              relationType: 'PRECEDES',
              weight: 1,
            };
            console.log('Relation payload:', relationPayload);

            const relation = await firstValueFrom(
              this.neo4jClient.send('neo4j.create-relation', relationPayload)
            );

            console.log('Relation created:', relation);
            createdRelations.push(relation);
          } catch (error) {
            console.error(`LỖI tạo relation: "${tokens[i]}" -> "${tokens[i + 1]}"`, error);
            console.error('Error stack:', error.stack);
          }
        }

        console.log(`Đã tạo ${createdRelations.length} relations`);
      }

      const result = {
        success: true,
        text,
        totalNodes: createdNodes.length,
        totalRelations: createdRelations.length,
        nodes: createdNodes,
        relations: createdRelations,
      };

      console.log('=== KẾT QUẢ CUỐI CÙNG ===');
      console.log(JSON.stringify(result, null, 2));

      return result;
    } catch (error) {
      console.error('LỖI NGHIÊM TRỌNG trong analyzeAndCreateGraph:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      throw new InternalServerErrorException(`Không thể tạo graph từ văn bản: ${error.message}`);
    }
  }

  private getPosTagInfo(posTag: string) {
    const POS_TAG_INFO = {
      'N': { fullName: 'Noun', vnName: 'Danh từ' },
      'Np': { fullName: 'Proper Noun', vnName: 'Danh từ riêng' },
      'Nc': { fullName: 'Noun Category', vnName: 'Danh từ chỉ loại' },
      'Nu': { fullName: 'Noun Unit', vnName: 'Danh từ đơn vị' },
      'V': { fullName: 'Verb', vnName: 'Động từ' },
      'Vb': { fullName: 'Borrowed Verb', vnName: 'Động từ mượn' },
      'A': { fullName: 'Adjective', vnName: 'Tính từ' },
      'Ab': { fullName: 'Borrowed Adjective', vnName: 'Tính từ mượn' },
      'P': { fullName: 'Pronoun', vnName: 'Đại từ' },
      'R': { fullName: 'Adverb', vnName: 'Phó từ' },
      'L': { fullName: 'Determiner', vnName: 'Định từ' },
      'M': { fullName: 'Numeral', vnName: 'Số từ' },
      'E': { fullName: 'Adposition', vnName: 'Giới từ' },
      'C': { fullName: 'Coordinating Conjunction', vnName: 'Liên từ' },
      'Cc': { fullName: 'Subordinating Conjunction', vnName: 'Liên từ đẳng lập' },
      'I': { fullName: 'Interjection', vnName: 'Thán từ' },
      'T': { fullName: 'Particle', vnName: 'Trợ từ' },
      'CH': { fullName: 'Chunk', vnName: 'Dấu câu' },
      'X': { fullName: 'Unknown', vnName: 'Không phân loại' },
    };
    return POS_TAG_INFO[posTag] || { fullName: posTag, vnName: posTag };
  }

  //Xác định loại quan hệ ngữ nghĩa giữa 2 từ dựa trên POS tags
  private determineRelationType(currentTag: string, nextTag: string): string {
    // Danh từ + Động từ: chủ ngữ - vị ngữ
    if (currentTag.startsWith('N') && nextTag.startsWith('V')) {
      return 'Noun_Verb';
    }

    // Động từ + Danh từ: động từ - tân ngữ
    if (currentTag.startsWith('V') && nextTag.startsWith('N')) {
      return 'Verb_Noun';
    }

    // Tính từ + Danh từ: bổ nghĩa
    if (currentTag.startsWith('A') && nextTag.startsWith('N')) {
      return 'Adjective_Noun';
    }

    // Phó từ + Động từ: bổ nghĩa
    if (currentTag === 'R' && nextTag.startsWith('V')) {
      return 'Adverb-Verb';
    }

    // Phó từ + Tính từ: bổ nghĩa
    if (currentTag === 'R' && currentTag.startsWith('A')) {
      return 'Adverb-Adjective';
    }

    // Giới từ + Danh từ: cụm giới từ
    if (currentTag === 'E' && nextTag.startsWith('N')) {
      return 'Adposition_Noun';
    }

    // Định từ + Danh từ: xác định
    if (currentTag === 'L' && nextTag.startsWith('N')) {
      return 'Determiner_Noun';
    }

    // Số từ + Danh từ: đếm/định lượng
    if (currentTag === 'M' && nextTag.startsWith('N')) {
      return 'Numeral_Noun';
    }

    // Số từ + Danh từ đơn vị: số + đơn vị
    if (currentTag === 'M' && nextTag === 'Nu') {
      return 'Numeral_Unit';
    }

    // Danh từ + Danh từ: cụm danh từ phức hợp
    if (currentTag.startsWith('N') && nextTag.startsWith('N')) {
      return 'Noun_Compound';
    }

    // Động từ + Động từ: chuỗi động từ
    if (currentTag.startsWith('V') && nextTag.startsWith('V')) {
      return 'Verb_Serial';
    }

    // Liên từ kết nối 2 thành phần
    if (currentTag === 'C' || currentTag === 'Cc') {
      return 'Conjuncts';
    }

    // Trợ từ
    if (currentTag === 'T') {
      return 'Particle';
    }

    // Mặc định
    return 'Related_To';
  }
  
  // // Phân tích văn bản và tạo graph với các mối quan hệ ngữ nghĩa
  // async analyzeAndCreateSemanticGraph(text: string) {
  //   try {
  //     const posResult = await firstValueFrom(
  //       this.undertheseaClient.send('underthesea.pos', { text: text })
  //     );

  //     if (!posResult.success) {
  //       throw new InternalServerErrorException('Không thể phân tích POS');
  //     }

  //     const { tokens, pos_tags } = posResult;

  //     // ✅ Danh sách đầy đủ các đại từ nhân xưng và xưng hô trong tiếng Việt
  //     const PRONOUNS = new Set([
  //       // Đại từ ngôi thứ nhất
  //       'tôi', 'tui', 'tao', 'tớ', 'mình', 'chúng tôi', 'chúng ta', 'chúng mình',
        
  //       // Đại từ ngôi thứ hai
  //       'bạn', 'mày', 'cậu', 'các bạn', 'quý vị',
        
  //       // Đại từ ngôi thứ ba
  //       'họ', 'nó', 'hắn', 'y', 'chúng nó',
        
  //       // Đại từ xưng hô gia đình/thân tộc
  //       'anh', 'chị', 'em', 'ông', 'bà', 'cháu',
  //       'bố', 'ba', 'tía', 'con', 'mẹ', 'má',
  //       'chú', 'bác', 'cô', 'dì'
  //     ]);

  //     // ✅ Trích xuất POS tags và override cho đại từ nhân xưng
  //     const extractedPosTags = pos_tags.map((item, index) => {
  //       // Lấy POS tag từ mảng 2 chiều hoặc string
  //       const posTag = Array.isArray(item) ? item[1] : item;
        
  //       // Kiểm tra nếu token là đại từ nhân xưng → gán label "P"
  //       const currentToken = tokens[index].toLowerCase();
  //       if (PRONOUNS.has(currentToken)) {
  //         console.log(`Token "${tokens[index]}" được nhận dạng là đại từ nhân xưng → Label: P`);
  //         return 'P';
  //       }
        
  //       return posTag;
  //     });

  //     const createdNodes = [];
  //     const createdRelations = [];
  //     const pronounNodes = []; // ✅ Danh sách riêng cho các đại từ (label = "P")

  //     // Tạo nodes (TẤT CẢ các từ)
  //     console.log('=== BẮT ĐẦU TẠO NODES ===');
  //     for (let i = 0; i < tokens.length; i++) {
  //       try {
  //         const nodePayload = {
  //           label: extractedPosTags[i],
  //           name: tokens[i],
  //         };
          
  //         console.log(`Tạo node ${i + 1}/${tokens.length}: "${tokens[i]}" (${extractedPosTags[i]})`);
          
  //         const node = await firstValueFrom(
  //           this.neo4jClient.send('neo4j.create-node', nodePayload)
  //         );
          
  //         const nodeData = {
  //           token: tokens[i],
  //           posTag: extractedPosTags[i],
  //           posInfo: this.getPosTagInfo(extractedPosTags[i]),
  //           node,
  //         };
          
  //         createdNodes.push(nodeData);
          
  //         // ✅ Nếu là đại từ (label = "P"), thêm vào danh sách riêng
  //         if (extractedPosTags[i] === 'P') {
  //           pronounNodes.push(nodeData);
  //           console.log(`  → Đã thêm vào danh sách pronouns`);
  //         }
  //       } catch (error) {
  //         console.error(`Lỗi khi tạo node cho token "${tokens[i]}":`, error.message);
  //         console.error('Error stack:', error.stack);
  //       }
  //     }

  //     console.log(`Đã tạo ${createdNodes.length} nodes (trong đó có ${pronounNodes.length} đại từ)`);

  //     // Tạo relations dựa trên ngữ nghĩa (TẤT CẢ các quan hệ)
  //     console.log('=== BẮT ĐẦU TẠO RELATIONS ===');
  //     for (let i = 0; i < tokens.length - 1; i++) {
  //       const currentTag = extractedPosTags[i];
  //       const nextTag = extractedPosTags[i + 1];

  //       // Bỏ qua dấu câu
  //       if (currentTag === 'CH' || nextTag === 'CH') {
  //         console.log(`Bỏ qua relation có dấu câu: "${tokens[i]}" (${currentTag}) -> "${tokens[i + 1]}" (${nextTag})`);
  //         continue;
  //       }

  //       const relationType = this.determineRelationType(currentTag, nextTag);

  //       try {
  //         const relationPayload = {
  //           fromLabel: currentTag,
  //           fromName: tokens[i],
  //           toLabel: nextTag,
  //           toName: tokens[i + 1],
  //           relationType,
  //           weight: 1,
  //         };
          
  //         console.log(`Tạo relation ${i + 1}: "${tokens[i]}" (${currentTag}) -[${relationType}]-> "${tokens[i + 1]}" (${nextTag})`);
          
  //         const relation = await firstValueFrom(
  //           this.neo4jClient.send('neo4j.create-relation', relationPayload)
  //         );
          
  //         createdRelations.push({
  //           ...relation,
  //           relationDescription: this.getRelationDescription(relationType),
  //         });
  //       } catch (error) {
  //         console.error(`Lỗi khi tạo relation: "${tokens[i]}" -> "${tokens[i + 1]}"`, error.message);
  //         console.error('Error stack:', error.stack);
  //       }
  //     }

  //     console.log(`Đã tạo ${createdRelations.length} relations`);

  //     const result = {
  //       success: true,
  //       text,
  //       totalNodes: createdNodes.length,
  //       totalRelations: createdRelations.length,
  //       totalPronouns: pronounNodes.length, // ✅ Số lượng đại từ
  //       nodes: createdNodes,
  //       relations: createdRelations,
  //       pronouns: pronounNodes, // ✅ Danh sách các đại từ (label = "P")
  //     };

  //     console.log('=== KẾT QUẢ CUỐI CÙNG ===');
  //     console.log(`- Tổng nodes: ${result.totalNodes}`);
  //     console.log(`- Tổng relations: ${result.totalRelations}`);
  //     console.log(`- Tổng đại từ: ${result.totalPronouns}`);
  //     console.log(`- Danh sách đại từ:`, pronounNodes.map(p => p.token).join(', '));

  //     return result;
  //   } catch (error) {
  //     console.error('Lỗi nghiêm trọng trong quá trình tạo semantic graph:', error);
  //     console.error('Error message:', error.message);
  //     console.error('Error stack:', error.stack);
  //     throw new InternalServerErrorException(`Không thể tạo semantic graph: ${error.message}`);
  //   }
  // }



// Hàm đọc tất cả file txt trong folder
async getTextFiles(folderPath: string): Promise<string[]> {
  try {
    const files = await readdir(folderPath);
    const txtFiles = files
      .filter(file => file.endsWith('.txt'))
      .map(file => path.join(folderPath, file))
      .sort((a, b) => {
        // Sắp xếp theo số trong tên file (1.txt, 2.txt, ...)
        const numA = parseInt(path.basename(a, '.txt'));
        const numB = parseInt(path.basename(b, '.txt'));
        return numA - numB;
      });
    
    return txtFiles;
  } catch (error) {
    console.error(`Lỗi khi đọc folder ${folderPath}:`, error.message);
    throw error;
  }
}

// Hàm xử lý batch tất cả các file
async processBatchFiles(folderPath: string = 'data_test/test/pos') {
  console.log('='.repeat(80));
  console.log('🚀 BẮT ĐẦU XỬ LÝ BATCH FILES');
  console.log('='.repeat(80));
  
  const startTime = Date.now();
  const results = {
    total: 0,
    success: 0,
    failed: 0,
    details: [],
    errors: []
  };

  try {
    // Lấy danh sách file
    const txtFiles = await this.getTextFiles(folderPath);
    results.total = txtFiles.length;
    
    console.log(`📁 Tìm thấy ${txtFiles.length} file txt trong folder: ${folderPath}`);
    console.log('');

    // Xử lý từng file
    for (let i = 0; i < txtFiles.length; i++) {
      const filePath = txtFiles[i];
      const fileName = path.basename(filePath);
      
      console.log(`\n[${ i + 1}/${txtFiles.length}] 📄 Đang xử lý: ${fileName}`);
      console.log('-'.repeat(60));
      
      try {
        // Đọc nội dung file
        const text = await readFile(filePath, 'utf-8');
        
        if (!text || text.trim().length === 0) {
          console.log(`⚠️  File rỗng, bỏ qua...`);
          results.details.push({
            file: fileName,
            status: 'skipped',
            reason: 'empty_file'
          });
          continue;
        }

        console.log(`📝 Nội dung: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
        console.log(`📏 Độ dài: ${text.length} ký tự`);
        
        // Gọi hàm phân tích semantic graph
        const result = await this.analyzeAndCreateSemanticGraph(text);
        
        results.success++;
        results.details.push({
          file: fileName,
          status: 'success',
          nodes: result.totalNodes,
          relations: result.totalRelations,
          pronouns: result.totalPronouns,
          text: text.substring(0, 100)
        });
        
        console.log(`✅ Thành công: ${result.totalNodes} nodes, ${result.totalRelations} relations, ${result.totalPronouns} pronouns`);
        
      } catch (error) {
        results.failed++;
        results.errors.push({
          file: fileName,
          error: error.message,
          stack: error.stack
        });
        
        console.error(`❌ Lỗi khi xử lý file ${fileName}:`, error.message);
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Tổng kết
    console.log('\n' + '='.repeat(80));
    console.log('📊 TỔNG KẾT');
    console.log('='.repeat(80));
    console.log(`✅ Thành công: ${results.success}/${results.total} files`);
    console.log(`❌ Thất bại: ${results.failed}/${results.total} files`);
    console.log(`⏱️  Thời gian: ${duration}s`);
    console.log(`⚡ Tốc độ: ${(results.total / parseFloat(duration)).toFixed(2)} files/s`);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️  DANH SÁCH LỖI:');
      results.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err.file}: ${err.error}`);
      });
    }

    return results;

  } catch (error) {
    console.error('❌ Lỗi nghiêm trọng trong quá trình xử lý batch:', error);
    throw new InternalServerErrorException(`Không thể xử lý batch files: ${error.message}`);
  }
}

// Phân tích văn bản và cập nhật weight tích lũy
async analyzeAndCreateSemanticGraph(text: string) {
  try {
    const posResult = await firstValueFrom(
      this.undertheseaClient.send('underthesea.pos', { text: text })
    );

    if (!posResult.success) {
      throw new InternalServerErrorException('Không thể phân tích POS');
    }

    const { tokens, pos_tags } = posResult;

    const PRONOUNS = new Set([
      'tôi', 'tui', 'tao', 'tớ', 'mình', 'chúng tôi', 'chúng ta', 'chúng mình',
      'bạn', 'mày', 'cậu', 'các bạn', 'quý vị',
      'họ', 'nó', 'hắn', 'y', 'chúng nó',
      'anh', 'chị', 'em', 'ông', 'bà', 'cháu',
      'bố', 'ba', 'tía', 'con', 'mẹ', 'má',
      'chú', 'bác', 'cô', 'dì'
    ]);

    const extractedPosTags = pos_tags.map((item, index) => {
      const posTag = Array.isArray(item) ? item[1] : item;
      const currentToken = tokens[index].toLowerCase();
      if (PRONOUNS.has(currentToken)) {
        return 'P';
      }
      return posTag;
    });

    const createdNodes = [];
    const updatedRelations = [];
    const pronounNodes = []; // Danh sách riêng cho các đại từ (label = "P")

    // ========== BƯỚC 1: Tạo hoặc lấy nodes (không tăng weight ở đây) ==========
    console.log('=== BƯỚC 1: XỬ LÝ NODES ===');
    for (let i = 0; i < tokens.length; i++) {
      try {
        const nodePayload = {
          label: extractedPosTags[i],
          name: tokens[i],
        };
        
        // Tạo node hoặc lấy node đã tồn tại
        const node = await firstValueFrom(
          this.neo4jClient.send('neo4j.create-node', nodePayload)
        );
        
        const nodeData = {
          token: tokens[i],
          posTag: extractedPosTags[i],
          posInfo: this.getPosTagInfo(extractedPosTags[i]),
          node,
        };
        
        createdNodes.push(nodeData);
        
        if (extractedPosTags[i] === 'P') {
          pronounNodes.push(nodeData);
        }
      } catch (error) {
        console.error(`Lỗi khi tạo node cho token "${tokens[i]}":`, error.message);
      }
    }

    // ========== BƯỚC 2: Xử lý relations và cập nhật weight ==========
    console.log('=== BƯỚC 2: XỬ LÝ RELATIONS VÀ TĂNG WEIGHT ===');
    
    for (let i = 0; i < tokens.length - 1; i++) {
      const currentTag = extractedPosTags[i];
      const nextTag = extractedPosTags[i + 1];

      // Bỏ qua dấu câu
      if (currentTag === 'CH' || nextTag === 'CH') {
        continue;
      }

      const relationType = this.determineRelationType(currentTag, nextTag);

      try {
        // 🔍 Kiểm tra xem relation đã tồn tại chưa
        const existingRelation = await firstValueFrom(
          this.neo4jClient.send('neo4j.get-relation', {
            fromLabel: currentTag,
            fromName: tokens[i],
            toLabel: nextTag,
            toName: tokens[i + 1],
            relationType,
          })
        );

        let newWeight = 0;
        let operation = '';

        if (existingRelation && existingRelation.weight !== undefined) {
          // ✅ Relation đã tồn tại → TĂNG weight
          const oldWeight = existingRelation.weight;
          
          // Tăng weight theo công thức tích lũy
          const increment = await this.calculateWeightIncrement({
            fromLabel: currentTag,
            fromName: tokens[i],
            toLabel: nextTag,
            toName: tokens[i + 1],
            currentWeight: oldWeight,
          });
          
          newWeight = oldWeight + increment;
          operation = 'UPDATE';
          
          console.log(`📈 "${tokens[i]}" -> "${tokens[i + 1]}": ${oldWeight.toFixed(4)} → ${newWeight.toFixed(4)} (+${increment.toFixed(4)})`);
        } else {
          // 🆕 Relation mới → Khởi tạo weight = 0
          newWeight = 0;
          operation = 'CREATE';
          
          console.log(`🆕 "${tokens[i]}" -> "${tokens[i + 1]}": CREATED with weight = 0`);
        }

        // Cập nhật hoặc tạo relation trong Neo4j
        const relationPayload = {
          fromLabel: currentTag,
          fromName: tokens[i],
          toLabel: nextTag,
          toName: tokens[i + 1],
          relationType,
          weight: newWeight,
        };
        
        const relation = await firstValueFrom(
          this.neo4jClient.send('neo4j.create-relation', relationPayload)
        );
        
        updatedRelations.push({
          ...relation,
          operation,
          relationDescription: this.getRelationDescription(relationType),
        });
        
      } catch (error) {
        console.error(`Lỗi khi xử lý relation: "${tokens[i]}" -> "${tokens[i + 1]}"`, error.message);
      }
    }

    // ========== BƯỚC 3: Chuẩn hóa tất cả weight về [0,1] ==========
    console.log('=== BƯỚC 3: CHUẨN HÓA WEIGHT ===');
    await this.normalizeAllWeights();

    // ========== BƯỚC 4: Lấy lại relations sau khi chuẩn hóa ==========
    const normalizedRelations = await this.getUpdatedRelations(updatedRelations);

    return {
      success: true,
      text,
      totalNodes: createdNodes.length,
      totalRelations: updatedRelations.length,
      totalPronouns: pronounNodes.length,
      nodes: createdNodes,
      relations: normalizedRelations,
      pronouns: pronounNodes,
    };
  } catch (error) {
    console.error('Lỗi trong quá trình tạo semantic graph:', error.message);
    throw new InternalServerErrorException(`Không thể tạo semantic graph: ${error.message}`);
  }
}


// ========== TÍNH TOÁN INCREMENT WEIGHT ==========
private async calculateWeightIncrement(params: {
  fromLabel: string;
  fromName: string;
  toLabel: string;
  toName: string;
  currentWeight: number;
}): Promise<number> {
  const { fromLabel, fromName, toLabel, toName, currentWeight } = params;
 
  // 1️⃣ Base increment (cơ bản mỗi lần xuất hiện)
  let increment = 1.0;

  // 2️⃣ Lấy tất cả relations từ cùng node gốc (fromName)
  const siblingRelations = await firstValueFrom(
    this.neo4jClient.send('neo4j.get-relations-from-node', {
      label: fromLabel,
      name: fromName,
    })
  );

  if (siblingRelations && siblingRelations.length > 0) {
    // Tính trung bình weight của các relations anh em
    const siblingWeights = siblingRelations
      .filter(r => r.weight !== undefined)
      .map(r => r.weight);
    
    if (siblingWeights.length > 0) {
      const avgSiblingWeight = siblingWeights.reduce((sum, w) => sum + w, 0) / siblingWeights.length;
      
      // 3️⃣ Điều chỉnh increment dựa trên context
      // Nếu relation này có weight thấp hơn trung bình → tăng nhanh hơn
      // Nếu đã cao hơn trung bình → tăng chậm lại
      const ratio = currentWeight / (avgSiblingWeight + 0.01); // +0.01 để tránh chia cho 0
      
      if (ratio < 1) {
        // Weight thấp hơn TB → boost
        increment *= (1.5 - ratio * 0.5); // boost 1.5x → 1x
      } else {
        // Weight cao hơn TB → giảm tốc
        increment *= (1 / (1 + ratio * 0.2)); // giảm dần
      }
      
      console.log(`  🔗 Sibling context: avg=${avgSiblingWeight.toFixed(4)}, ratio=${ratio.toFixed(2)}, increment=${increment.toFixed(4)}`);
    }
  }

  // 4️⃣ Lấy relations đến cùng node đích (toName) - Incoming relations
  const incomingRelations = await firstValueFrom(
    this.neo4jClient.send('neo4j.get-relations-to-node', {
      label: toLabel,
      name: toName,
    })
  );

  if (incomingRelations && incomingRelations.length > 1) {
    // Node đích được nhiều node khác trỏ đến → đây là node quan trọng
    // → Tăng weight nhanh hơn
    const popularityBoost = Math.log(incomingRelations.length + 1) * 0.2;
    increment *= (1 + popularityBoost);
    
    console.log(`  ⭐ Target popularity: ${incomingRelations.length} incoming, boost=${popularityBoost.toFixed(4)}`);
  }

  return increment;
}

// ========== CHUẨN HÓA TẤT CẢ WEIGHT VỀ [0,1] ==========
private async normalizeAllWeights(): Promise<void> {
  try {
    // Lấy tất cả relations trong database
    const allRelations = await firstValueFrom(
      this.neo4jClient.send('neo4j.get-all-relations', {})
    );

    if (!allRelations || allRelations.length === 0) {
      console.log('⚠️  Không có relation nào để chuẩn hóa');
      return;
    }

    // Tìm min và max weight
    const weights = allRelations
      .filter(r => r.weight !== undefined && r.weight !== null)
      .map(r => r.weight);

    if (weights.length === 0) {
      console.log('⚠️  Không có weight nào để chuẩn hóa');
      return;
    }

    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);

    console.log(`📊 Weight range: [${minWeight.toFixed(4)}, ${maxWeight.toFixed(4)}]`);

    if (maxWeight === minWeight) {
      console.log('⚠️  Tất cả weight bằng nhau, không cần chuẩn hóa');
      return;
    }

    // Chuẩn hóa từng relation
    const updates = [];
    for (const relation of allRelations) {
      if (relation.weight !== undefined && relation.weight !== null) {
        const normalizedWeight = (relation.weight - minWeight) / (maxWeight - minWeight);
        
        updates.push({
          id: relation.id,
          fromLabel: relation.fromLabel,
          fromName: relation.fromName,
          toLabel: relation.toLabel,
          toName: relation.toName,
          relationType: relation.relationType,
          normalizedWeight: Number(normalizedWeight.toFixed(4)),
        });
      }
    }

    // Batch update
    await firstValueFrom(
      this.neo4jClient.send('neo4j.batch-update-weights', { updates })
    );

    console.log(`✅ Đã chuẩn hóa ${updates.length} relations`);

  } catch (error) {
    console.error('Lỗi khi chuẩn hóa weight:', error.message);
    throw error;
  }
}

// ========== LẤY RELATIONS SAU KHI CHUẨN HÓA ==========
private async getUpdatedRelations(relations: any[]): Promise<any[]> {
  const updated = [];
  
  for (const rel of relations) {
    try {
      const refreshed = await firstValueFrom(
        this.neo4jClient.send('neo4j.get-relation', {
          fromLabel: rel.fromLabel,
          fromName: rel.fromName,
          toLabel: rel.toLabel,
          toName: rel.toName,
          relationType: rel.relationType,
        })
      );
      
      updated.push({
        ...rel,
        weight: refreshed.weight,
        normalizedWeight: refreshed.normalizedWeight || refreshed.weight,
      });
    } catch (error) {
      console.error('Lỗi khi lấy relation đã cập nhật:', error.message);
      updated.push(rel);
    }
  }
  
  return updated;
}





// ===== CÁCH SỬ DỤNG =====

// 1. Xử lý tất cả file trong folder mặc định
async runBatchProcessing() {
  const results = await this.processBatchFiles();
  return results;
}

// 2. Xử lý với đường dẫn tùy chỉnh
async runBatchProcessingCustomPath() {
  const results = await this.processBatchFiles('data_test/test/pos');
  return results;
}



  // Mô tả ý nghĩa của các loại quan hệ
  private getRelationDescription(relationType: string): string {
    const descriptions = {
      'SUBJECT_OF': 'là chủ ngữ của',
      'HAS_OBJECT': 'có tân ngữ là',
      'MODIFIES': 'bổ nghĩa cho',
      'PREPOSITION_OF': 'tạo cụm giới từ với',
      'DETERMINES': 'xác định',
      'QUANTIFIES': 'định lượng',
      'HAS_UNIT': 'có đơn vị',
      'COMPOUND_WITH': 'tạo cụm từ với',
      'SERIAL_VERB': 'nối tiếp với động từ',
      'CONJUNCTS': 'liên kết',
      'ASSISTS': 'hỗ trợ',
      'RELATES_TO': 'liên quan đến',
      'PRECEDES': 'đứng trước',
    };
    return descriptions[relationType] || relationType;
  }

  //Phân tích nhiều câu và tích lũy weight cho các mối quan hệ
  async buildKnowledgeGraph(texts: string[]) {
    const stats = {
      totalTexts: texts.length,
      successCount: 0,
      failCount: 0,
      totalNodes: 0,
      totalRelations: 0,
      errors: [],
    };

    for (const text of texts) {
      try {
        const result = await this.analyzeAndCreateSemanticGraph(text);
        if (result.success) {
          stats.successCount++;
          stats.totalNodes += result.totalNodes;
          stats.totalRelations += result.totalRelations;
        }
      } catch (error) {
        stats.failCount++;
        stats.errors.push({ text, error: error.message });
        console.error(`Lỗi khi xử lý văn bản "${text}":`, error.message);
      }
    }

    return stats;
  }

  // Lấy gợi ý từ tiếp theo dựa trên từ hiện tại và POS tag
  async getNextWordSuggestion(
    word: string,
    currentPosTag: string,
    targetPosTag?: string,
  ) {
    try {
      let suggestions;

      if (targetPosTag) {
        // Tìm từ có POS tag cụ thể
        suggestions = await this.neo4jClient.send('neo4j.get-suggestions', {
          word,
          currentPosTag,
          targetPosTag,
        }
        );
      } else {
        // Tìm tất cả các từ có thể xuất hiện sau
        suggestions = await this.neo4jClient.send('neo4j.get-suggestions', word);
      }

      return {
        success: true,
        word,
        currentPosTag,
        currentPosInfo: POS_TAG_INFO[currentPosTag] || null,
        targetPosTag: targetPosTag || 'all',
        suggestions,
      };
    } catch (error) {
      console.error('Lỗi khi lấy gợi ý:', error);
      throw new InternalServerErrorException('Không thể lấy gợi ý');
    }
  }

  //Phân tích cấu trúc câu cơ bản (S-V-O)
  async analyzeSentenceStructure(text: string) {
    try {
      const posResult = await firstValueFrom(this.undertheseaClient.send('underthesea.pos', { text: text }));

      if (!posResult.success) {
        throw new InternalServerErrorException('Không thể phân tích POS');
      }

      const { tokens, pos_tags } = posResult;
      const structure = {
        subject: [],
        verb: [],
        object: [],
        modifiers: [],
        others: [],
      };

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const tag = pos_tags[i];

        if (tag.startsWith('N') || tag === 'P') {
          // Kiểm tra xem có phải chủ ngữ không (trước động từ)
          const nextVerb = pos_tags.slice(i + 1).findIndex(t => t.startsWith('V'));
          if (nextVerb !== -1) {
            structure.subject.push({ token, tag });
          } else {
            structure.object.push({ token, tag });
          }
        } else if (tag.startsWith('V')) {
          structure.verb.push({ token, tag });
        } else if (tag.startsWith('A') || tag === 'R') {
          structure.modifiers.push({ token, tag });
        } else {
          structure.others.push({ token, tag });
        }
      }

      return {
        success: true,
        text,
        structure,
        summary: {
          hasSubject: structure.subject.length > 0,
          hasVerb: structure.verb.length > 0,
          hasObject: structure.object.length > 0,
          isComplete: structure.subject.length > 0 && structure.verb.length > 0,
        },
      };
    } catch (error) {
      console.error('Lỗi khi phân tích cấu trúc câu:', error);
      throw new InternalServerErrorException('Không thể phân tích cấu trúc câu');
    }
  }

  //Lấy thống kê về các POS tags trong văn bản
  async getPosStatistics(text: string) {
    try {
      const posResult = await firstValueFrom(this.undertheseaClient.send('underthesea.pos', { text: text }));

      if (!posResult.success) {
        throw new InternalServerErrorException('Không thể phân tích POS');
      }

      const { tokens, pos_tags } = posResult;
      const statistics = {};

      for (const tag of pos_tags) {
        if (!statistics[tag]) {
          statistics[tag] = {
            count: 0,
            percentage: 0,
            info: POS_TAG_INFO[tag] || { fullName: tag, vnName: tag },
            examples: [],
          };
        }
        statistics[tag].count++;

        const index = pos_tags.indexOf(tag);
        if (statistics[tag].examples.length < 3) {
          statistics[tag].examples.push(tokens[index]);
        }
      }

      // Tính phần trăm
      const total = tokens.length;
      for (const tag in statistics) {
        statistics[tag].percentage = ((statistics[tag].count / total) * 100).toFixed(2);
      }

      return {
        success: true,
        text,
        totalTokens: total,
        uniqueTags: Object.keys(statistics).length,
        statistics,
      };
    } catch (error) {
      console.error('Lỗi khi thống kê POS:', error);
      throw new InternalServerErrorException('Không thể thống kê POS');
    }
  }

  // Tìm từ trong graph và lấy thông tin liên quan
  async findWord(word: string) {
    try {
      const nodes = await firstValueFrom(
        this.neo4jClient.send('neo4j.get-suggestions', { word: word })
      );
      return {
        success: true,
        word,
        nodes,
      };
    } catch (error) {
      console.error('Lỗi khi tìm từ trong graph:', error);
      throw new InternalServerErrorException('Không thể tìm từ trong graph');
    }
  }

  async findWordByLabel(word: string, toLabel: string) {
    try {
      const nodes = await firstValueFrom(
        this.neo4jClient.send('neo4j.find-word-by-label', { word, toLabel })
      );
      return {
        success: true,
        word,
        toLabel,
        nodes,
      };
    }
    catch (error) {
      console.error('Lỗi khi tìm từ theo label trong graph:', error);
      throw new InternalServerErrorException('Không thể tìm từ theo label trong graph');
    }
  }
}