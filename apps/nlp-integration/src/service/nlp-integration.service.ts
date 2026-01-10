import { Inject, Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

// ==================== PHOBERT CONFIG ====================
const PHOBERT_API_URL = process.env.PHOBERT_API_URL || 'https://veinless-unslanderously-jordyn.ngrok-free.dev'; // ⚠️ Thay bằng URL từ PhoBERT server
const PHOBERT_HEALTH_CHECK = `${PHOBERT_API_URL}/health`;
const PHOBERT_PREDICT_URL = `${PHOBERT_API_URL}/predict`;

// ==================== WEIGHT COMBINING STRATEGIES ====================
enum MergeStrategy {
  WEIGHTED_SUM = 'weighted_sum',      // α*neo4j + β*phobert
  MULTIPLY = 'multiply',               // neo4j * phobert
  HARMONIC_MEAN = 'harmonic_mean',     // 2/(1/neo4j + 1/phobert)
  MAX = 'max',                         // max(neo4j, phobert)
}
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
  // Cấu hình merge strategy
  private readonly MERGE_STRATEGY = MergeStrategy.WEIGHTED_SUM;
  private readonly NEO4J_WEIGHT = 0.4;  // α
  private readonly PHOBERT_WEIGHT = 0.6; // β

  constructor(
    @Inject('UNDERTHESEA_CLIENT') private readonly undertheseaClient: ClientProxy,
    @Inject('NEO4J_CLIENT') private readonly neo4jClient: ClientProxy,
    @Inject('EMBEDDING_CLIENT') private readonly embeddingClient: ClientProxy,
    @Inject('QDRANT_CLIENT') private readonly qdrantClient: ClientProxy,
  ) {
    this.checkPhoBERTHealth();
  }

  // ==================== PHOBERT HEALTH CHECK ====================
  private async checkPhoBERTHealth() {
    try {
      const response = await axios.get(PHOBERT_HEALTH_CHECK, { timeout: 5000 });
      console.log('✅ PhoBERT server is healthy:', response.data);
    } catch (error) {
      console.error('⚠️  PhoBERT server is not available:', error.message);
      console.error('    Make sure PhoBERT server is running!');
    }
  }

  // ==================== PHOBERT SCORING ====================
  /**
   * Gọi PhoBERT API để tính score cho các từ ứng viên
   * @param context - Ngữ cảnh hiện tại (câu đang nhập)
   * @param candidates - Danh sách từ ứng viên từ Neo4j
   * @param topK - Số lượng kết quả trả về
   */
  private async scoreWithPhoBERT(
    context: string,
    candidates: string[],
    topK: number = 10,
  ): Promise<Array<{ word: string; score: number; token_id: number }>> {
    try {
      if (!context || candidates.length === 0) {
        return [];
      }

      const response = await axios.post(
        PHOBERT_PREDICT_URL,
        {
          context: context.trim(),
          candidates,
          top_k: topK,
        },
        {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'PhoBERT prediction failed');
      }

      return response.data.predictions || [];
    } catch (error) {
      console.error('❌ Lỗi khi gọi PhoBERT API:', error.message);

      if (error.code === 'ECONNREFUSED') {
        console.error('    PhoBERT server không khả dụng!');
      }

      // Fallback: trả về empty array thay vì throw error
      return [];
    }
  }

  // ==================== MERGE SCORES ====================
  /**
   * Kết hợp điểm từ Neo4j và PhoBERT
   */
  private mergeScores(
    neo4jScore: number,
    phobertScore: number,
    strategy: MergeStrategy = this.MERGE_STRATEGY,
  ): number {
    // Normalize về [0, 1]
    const n = Math.max(0, Math.min(1, neo4jScore));
    const p = Math.max(0, Math.min(1, phobertScore));

    switch (strategy) {
      case MergeStrategy.WEIGHTED_SUM:
        return this.NEO4J_WEIGHT * n + this.PHOBERT_WEIGHT * p;

      case MergeStrategy.MULTIPLY:
        return n * p;

      case MergeStrategy.HARMONIC_MEAN:
        if (n === 0 || p === 0) return 0;
        return 2 / (1 / n + 1 / p);

      case MergeStrategy.MAX:
        return Math.max(n, p);

      default:
        return this.NEO4J_WEIGHT * n + this.PHOBERT_WEIGHT * p;
    }
  }

  // ==================== UPDATED: findWord ====================
  /**
   * Tìm từ tiếp theo dựa trên từ hiện tại (không chỉ định POS tag)
   * Áp dụng Graph-Retrieve, BERT-Rank
   */
  async findWord(word: string, context: string = '', topK: number = 10): Promise<any> {
    try {
      // ✅ Validation
      if (!word || typeof word !== 'string' || word.trim().length === 0) {
        throw new BadRequestException('Từ tìm kiếm không hợp lệ');
      }

      const cleanWord = word.trim().toLowerCase();

      console.log('\n' + '='.repeat(80));
      console.log('🔍 FIND WORD - GRAPH-RETRIEVE + BERT-RANK');
      console.log('='.repeat(80));
      console.log(`📝 Word: "${cleanWord}"`);
      console.log(`📝 Context: "${context}"`);
      console.log(`🎯 Top-K: ${topK}`);

      // ========== STEP 1: GRAPH RETRIEVE (Neo4j) ==========
      console.log('\n📊 STEP 1: Graph Retrieve from Neo4j...');

      const neo4jCandidates = await firstValueFrom(
        this.neo4jClient.send('neo4j.get-suggestions', {
          word: cleanWord,
          limit: 20  // Lấy top 20 từ Neo4j
        })
      );

      if (!neo4jCandidates || neo4jCandidates.length === 0) {
        return {
          success: false,
          word: cleanWord,
          message: 'Không tìm thấy từ trong graph',
          results: [],
        };
      }

      console.log(`✅ Found ${neo4jCandidates.length} candidates from Neo4j`);

      // ========== STEP 2: BERT RANK (PhoBERT) ==========
      console.log('\n🤖 STEP 2: BERT Ranking...');

      // ✅ FIX: Handle different Neo4j response formats
      const candidateWords = neo4jCandidates.map(c => {
        // Neo4j có thể trả về: suggestion, word, toWord
        const word = c.suggestion || c.word || c.toWord;
        return typeof word === 'string' ? word : String(word);
      }).filter(Boolean); // Loại bỏ undefined/null

      let phobertScores: Map<string, number> = new Map();

      if (context && context.trim().length > 0) {
        const phobertResults = await this.scoreWithPhoBERT(context, candidateWords, topK);

        if (phobertResults.length > 0) {
          phobertResults.forEach(item => {
            phobertScores.set(item.word.toLowerCase(), item.score);
          });
          console.log(`✅ PhoBERT scored ${phobertResults.length} candidates`);
        } else {
          console.warn('⚠️  PhoBERT không khả dụng, chỉ dùng Neo4j scores');
        }
      } else {
        console.log('ℹ️  No context provided, skip PhoBERT ranking');
      }

      // ========== STEP 3: MERGE SCORES ==========
      console.log('\n🔀 STEP 3: Merge Scores...');

      const mergedResults = neo4jCandidates.map(candidate => {
        // ✅ FIX: Handle different Neo4j response formats
        const word = candidate.suggestion || candidate.word || candidate.toWord;
        const candidateWord = (word || '').toString().toLowerCase();

        // ✅ FIX: Handle different score field names
        const neo4jScore = candidate.score || candidate.weight || candidate.normalizedWeight || 0;
        const phobertScore = phobertScores.get(candidateWord) || 0;

        // Nếu không có context hoặc PhoBERT fail, dùng 100% Neo4j score
        const finalScore = phobertScore > 0
          ? this.mergeScores(neo4jScore, phobertScore)
          : neo4jScore;

        // ✅ FIX: Handle label as array or string
        let posTag = candidate.toLabel || candidate.label;
        if (Array.isArray(posTag)) {
          posTag = posTag[0] || 'Unknown'; // Lấy phần tử đầu tiên nếu là array
        }

        return {
          word: word || 'unknown',
          posTag: posTag || 'Unknown',
          neo4jScore,
          phobertScore,
          finalScore,
          relationType: candidate.relationType || 'Related_To',
        };
      });

      // Sort theo finalScore giảm dần
      mergedResults.sort((a, b) => b.finalScore - a.finalScore);

      // Lấy top-K
      const topResults = mergedResults.slice(0, topK);

      console.log('\n📊 Top Results:');
      topResults.slice(0, 5).forEach((r, idx) => {
        console.log(
          `  ${idx + 1}. "${r.word}" (${r.posTag}) - ` +
          `Neo4j: ${r.neo4jScore.toFixed(4)}, ` +
          `PhoBERT: ${r.phobertScore.toFixed(4)}, ` +
          `Final: ${r.finalScore.toFixed(4)}`
        );
      });

      return {
        success: true,
        word: cleanWord,
        context,
        strategy: this.MERGE_STRATEGY,
        totalCandidates: neo4jCandidates.length,
        results: topResults,
      };

    } catch (error) {
      console.error('❌ Lỗi trong findWord:', error);
      throw new InternalServerErrorException(`Không thể tìm từ: ${error.message}`);
    }
  }

  // ==================== UPDATED: findWordByLabel ====================
  /**
   * Tìm từ tiếp theo với POS tag cụ thể
   * Áp dụng Graph-Retrieve, BERT-Rank
   */
  async findWordByLabel(
    word: string,
    toLabel: string,
    context: string = '',
    topK: number = 10
  ): Promise<any> {
    try {
      // ✅ Validation
      if (!word || typeof word !== 'string' || word.trim().length === 0) {
        throw new BadRequestException('Từ tìm kiếm không hợp lệ');
      }

      if (!toLabel || typeof toLabel !== 'string' || toLabel.trim().length === 0) {
        throw new BadRequestException('Label không hợp lệ');
      }

      const cleanWord = word.trim().toLowerCase();
      const cleanLabel = toLabel.trim().toUpperCase();

      console.log('\n' + '='.repeat(80));
      console.log('🔍 FIND WORD BY LABEL - GRAPH-RETRIEVE + BERT-RANK');
      console.log('='.repeat(80));
      console.log(`📝 Word: "${cleanWord}"`);
      console.log(`🏷️  Label: ${cleanLabel}`);
      console.log(`📝 Context: "${context}"`);
      console.log(`🎯 Top-K: ${topK}`);

      // ========== STEP 1: GRAPH RETRIEVE (Neo4j) ==========
      console.log('\n📊 STEP 1: Graph Retrieve from Neo4j...');

      const neo4jCandidates = await firstValueFrom(
        this.neo4jClient.send('neo4j.find-word-by-label', {
          word: cleanWord,
          toLabel: cleanLabel,
          limit: 20
        })
      );

      if (!neo4jCandidates || neo4jCandidates.length === 0) {
        return {
          success: false,
          word: cleanWord,
          toLabel: cleanLabel,
          message: `Không tìm thấy từ "${cleanWord}" với label "${cleanLabel}"`,
          results: [],
        };
      }

      console.log(`✅ Found ${neo4jCandidates.length} candidates with label ${cleanLabel}`);

      // ========== STEP 2: BERT RANK ==========
      console.log('\n🤖 STEP 2: BERT Ranking...');

      // ✅ FIX: Handle different Neo4j response formats
      const candidateWords = neo4jCandidates.map(c => {
        const word = c.suggestion || c.word || c.toWord;
        return typeof word === 'string' ? word : String(word);
      }).filter(Boolean);

      let phobertScores: Map<string, number> = new Map();

      if (context && context.trim().length > 0) {
        const phobertResults = await this.scoreWithPhoBERT(context, candidateWords, topK);

        if (phobertResults.length > 0) {
          phobertResults.forEach(item => {
            phobertScores.set(item.word.toLowerCase(), item.score);
          });
          console.log(`✅ PhoBERT scored ${phobertResults.length} candidates`);
        } else {
          console.warn('⚠️  PhoBERT không khả dụng, chỉ dùng Neo4j scores');
        }
      } else {
        console.log('ℹ️  No context provided, skip PhoBERT ranking');
      }

      // ========== STEP 3: MERGE SCORES ==========
      console.log('\n🔀 STEP 3: Merge Scores...');

      const mergedResults = neo4jCandidates.map(candidate => {
        // ✅ FIX: Handle different Neo4j response formats
        const word = candidate.suggestion || candidate.word || candidate.toWord;
        const candidateWord = (word || '').toString().toLowerCase();

        // ✅ FIX: Handle different score field names
        const neo4jScore = candidate.score || candidate.weight || candidate.normalizedWeight || 0;
        const phobertScore = phobertScores.get(candidateWord) || 0;

        const finalScore = phobertScore > 0
          ? this.mergeScores(neo4jScore, phobertScore)
          : neo4jScore;

        // ✅ FIX: Handle label as array or string
        let posTag = candidate.toLabel || candidate.label;
        if (Array.isArray(posTag)) {
          posTag = posTag[0] || 'Unknown';
        }

        return {
          word: word || 'unknown',
          posTag: posTag || 'Unknown',
          neo4jScore,
          phobertScore,
          finalScore,
          relationType: candidate.relationType || 'Related_To',
        };
      });

      mergedResults.sort((a, b) => b.finalScore - a.finalScore);
      const topResults = mergedResults.slice(0, topK);

      console.log('\n📊 Top Results:');
      topResults.slice(0, 5).forEach((r, idx) => {
        console.log(
          `  ${idx + 1}. "${r.word}" (${r.posTag}) - ` +
          `Neo4j: ${r.neo4jScore.toFixed(4)}, ` +
          `PhoBERT: ${r.phobertScore.toFixed(4)}, ` +
          `Final: ${r.finalScore.toFixed(4)}`
        );
      });

      return {
        success: true,
        word: cleanWord,
        toLabel: cleanLabel,
        context,
        strategy: this.MERGE_STRATEGY,
        totalCandidates: neo4jCandidates.length,
        results: topResults,
      };

    } catch (error) {
      console.error('❌ Lỗi trong findWordByLabel:', error);
      throw new InternalServerErrorException(`Không thể tìm từ theo label: ${error.message}`);
    }
  }

  // ==================== UPDATED: getNextWordSuggestion ====================
  /**
   * Lấy gợi ý từ tiếp theo (wrapper cho findWord/findWordByLabel)
   * Áp dụng Graph-Retrieve, BERT-Rank
   */
  async getNextWordSuggestion(
    word: string,
    currentPosTag: string,
    context: string = '',
    targetPosTag?: string,
    topK: number = 10,
  ): Promise<any> {
    try {
      console.log('\n' + '='.repeat(80));
      console.log('💡 GET NEXT WORD SUGGESTION');
      console.log('='.repeat(80));

      let result;

      if (targetPosTag) {
        // Tìm theo label cụ thể
        result = await this.findWordByLabel(word, targetPosTag, context, topK);
      } else {
        // Tìm tất cả
        result = await this.findWord(word, context, topK);
      }

      return {
        success: result.success,
        word,
        currentPosTag,
        currentPosInfo: this.getPosTagInfo(currentPosTag),
        targetPosTag: targetPosTag || 'all',
        context,
        strategy: this.MERGE_STRATEGY,
        weights: {
          neo4j: this.NEO4J_WEIGHT,
          phobert: this.PHOBERT_WEIGHT,
        },
        suggestions: result.results || [],
        totalCandidates: result.totalCandidates,
      };

    } catch (error) {
      console.error('❌ Lỗi trong getNextWordSuggestion:', error);
      throw new InternalServerErrorException('Không thể lấy gợi ý');
    }
  }

  // ==================== HELPER: getPosTagInfo ====================
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
      return 'Adverb_Verb';
    }

    // Phó từ + Tính từ: bổ nghĩa
    if (currentTag === 'R' && currentTag.startsWith('A')) {
      return 'Adverb_Adjective';
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

        console.log(`\n[${i + 1}/${txtFiles.length}] 📄 Đang xử lý: ${fileName}`);
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
            text: text.substring(0, 100)
          });

          console.log(`✅ Thành công: ${result.totalNodes} nodes, ${result.totalRelations} relations`);

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
  // ========== CẬP NHẬT analyzeAndCreateSemanticGraph ==========
  /**
 * Phân tích văn bản và tạo Semantic Graph theo luồng:
 * 1. Gọi câu hỏi
 * 2. Tạo embedding (BAAI/bge-m3)
 * 3. So sánh trong VectorDB
 * 4. Query các thực thể được lấy từ Neo4j
 * 5. Lấy re-rank hợp tiếp theo cho câu (PhoBERT)
 * 6. Phân bố các từ liên quan vào 5 nút
 * 7. Gợi câu hỏi
 * 8. Tách từ, phân loại từ (Underthesea)
 * 9. Lưu và cập nhật vào Neo4j
 */
  async analyzeAndCreateSemanticGraph(text: string) {
    try {
      console.log('\n' + '='.repeat(80));
      console.log('🔍 SEMANTIC GRAPH ANALYSIS - Graph-Retrieve + BERT-Rank');
      console.log('='.repeat(80));
      console.log(`📝 Input: "${text}"`);

      // ========== BƯỚC 1: GỌI CÂU HỎI (Input) ==========
      console.log('\n=== BƯỚC 1: GỌI CÂU HỎI ===');
      if (!text || text.trim().length === 0) {
        throw new BadRequestException('Câu hỏi không được để trống');
      }
      const normalizedText = text.trim();
      console.log(`✅ Câu hỏi: "${normalizedText}"`);

      // ========== BƯỚC 2: TẠO EMBEDDING (BAAI/bge-m3) ==========
      console.log('\n=== BƯỚC 2: TẠO EMBEDDING ===');
      let questionEmbedding = null;

      try {
        questionEmbedding = await firstValueFrom(
          this.embeddingClient.send('embedding.generate', normalizedText)
        );
        console.log('✅ Generated embedding vector');
      } catch (error) {
        console.warn('⚠️  Embedding service không khả dụng:', error.message);
      }

      // ========== BƯỚC 3: SO SÁNH TRONG VECTORDB (Qdrant) ==========
      console.log('\n=== BƯỚC 3: SO SÁNH TRONG VECTORDB ===');
      let cachedResult = null;

      if (questionEmbedding) {
        try {
          const searchResult = await firstValueFrom(
            this.qdrantClient.send('qdrant.find-similar-questions', {
              queryVector: questionEmbedding,
              limit: 10,
              minSimilarity: 0.9,
            })
          );

          if (searchResult && searchResult.length > 0 && searchResult[0].similarity >= 0.85) {
            cachedResult = searchResult[0];
            console.log(`✅ Tìm thấy cache với similarity: ${cachedResult.similarity.toFixed(4)}`);

            return {
              success: true,
              fromCache: true,
              similarity: cachedResult.similarity,
              ...cachedResult.payload,
            };
          }

          console.log('❌ Không tìm thấy cache phù hợp');
        } catch (error) {
          console.warn('⚠️  Qdrant search failed:', error.message);
        }
      }

      // ========== BƯỚC 4: QUERY CÁC THỰC THỂ TỪ NEO4J ==========
      console.log('\n=== BƯỚC 4: QUERY CÁC THỰC THỂ ĐƯỢC LẤY ===');

      // 4.1: Tách từ và POS tagging bằng Underthesea
      const posResult = await firstValueFrom(
        this.undertheseaClient.send('underthesea.pos', { text: normalizedText })
      );

      if (!posResult.success) {
        throw new InternalServerErrorException('Không thể phân tích POS');
      }

      const { tokens, pos_tags } = posResult;
      console.log(`✅ POS Tagging: ${tokens.length} tokens`);

      // 4.2: Lọc và chuẩn hóa tokens
      const { processedTokens, processedPosTags } = this.filterAndNormalizeTokens(tokens, pos_tags);
      console.log(`✅ Filtered: ${processedTokens.length} valid tokens`);

      if (processedTokens.length === 0) {
        return {
          success: false,
          message: 'Không có token hợp lệ sau khi lọc',
          text: normalizedText,
          totalNodes: 0,
          totalRelations: 0,
          results: [],
        };
      }

      // 4.3: Lấy candidates từ Neo4j Graph cho mỗi token
      const graphCandidates = await this.retrieveGraphCandidates(processedTokens, processedPosTags);
      console.log(`✅ Retrieved ${graphCandidates.length} graph candidates`);

      // ========== BƯỚC 5: RE-RANK VỚI PHOBERT ==========
      console.log('\n=== BƯỚC 5: RE-RANK HỢP TIẾP THEO CHO CÂU (PhoBERT) ===');

      const rerankedResults = await this.rerankWithPhoBERT(
        normalizedText,
        graphCandidates,
        processedTokens
      );
      console.log(`✅ Re-ranked ${rerankedResults.length} candidates`);

      // ========== BƯỚC 6: PHÂN BỐ CÁC TỪ LIÊN QUAN VÀO 5 NÚT ==========
      console.log('\n=== BƯỚC 6: PHÂN BỐ CÁC TỪ LIÊN QUAN VÀO 5 NÚT ===');

      const clusteredResults = this.clusterIntoFiveNodes(rerankedResults);
      console.log(`✅ Clustered into ${clusteredResults.clusters.length} semantic groups`);

      // ========== BƯỚC 7: GỢI CÂU HỎI ==========
      console.log('\n=== BƯỚC 7: GỢI CÂU HỎI ===');

      const suggestions = this.generateSuggestions(clusteredResults, processedTokens);
      console.log(`✅ Generated ${suggestions.length} suggestions`);

      // ========== BƯỚC 8: TÁCH TỪ, PHÂN LOẠI TỪ (Underthesea) ==========
      // (Đã thực hiện ở bước 4.1)
      console.log('\n=== BƯỚC 8: TÁCH TỪ, PHÂN LOẠI TỪ ===');
      console.log('✅ Already completed in step 4.1');

      // ========== BƯỚC 9: LƯU VÀ CẬP NHẬT VÀO NEO4J ==========
      console.log('\n=== BƯỚC 9: LƯU VÀ CẬP NHẬT ===');

      const { nodes, relations } = await this.saveToNeo4j(
        processedTokens,
        processedPosTags,
        rerankedResults
      );
      console.log(`✅ Saved ${nodes.length} nodes and ${relations.length} relations`);

      // Chuẩn hóa weights
      await this.normalizeAllWeights(nodes);
      console.log('✅ Normalized weights');

      // ========== LƯU VÀO QDRANT CACHE ==========
      const resultPayload = {
        text: normalizedText,
        processedText: processedTokens.join(' '),
        totalNodes: nodes.length,
        totalRelations: relations.length,
        clusters: clusteredResults.clusters,
        suggestions,
        nodes,
        relations,
        timestamp: new Date().toISOString(),
      };

      if (questionEmbedding) {
        try {
          const questionId = `q_${Date.now()}_${Buffer.from(normalizedText).toString('base64').substring(0, 16)}`;

          await firstValueFrom(
            this.qdrantClient.send('qdrant.upsert-question', {
              questionId,
              vector: questionEmbedding,
              payload: resultPayload,
            })
          );
          console.log('✅ Cached result in Qdrant');
        } catch (error) {
          console.warn('⚠️  Failed to cache in Qdrant:', error.message);
        }
      }

      // ========== TRẢ VỀ KẾT QUẢ ==========
      console.log('\n' + '='.repeat(80));
      console.log('✅ HOÀN THÀNH PHÂN TÍCH SEMANTIC GRAPH');
      console.log('='.repeat(80));

      return {
        success: true,
        fromCache: false,
        ...resultPayload,
      };

    } catch (error) {
      console.error('❌ Lỗi trong analyzeAndCreateSemanticGraph:', error.message);
      throw new InternalServerErrorException(`Không thể phân tích: ${error.message}`);
    }
  }
  /**
 * ============================================================================
 * PROCESS QUESTION & ANSWER - COMPLETE FLOW WITH QDRANT
 * ============================================================================
 * 
 * Luồng hoạt động:
 * 1. Phân tích answer với underthesea.pos
 * 2. Tạo embedding cho question
 * 3. Tìm kiếm trong Qdrant (similarity > 0.9)
 * 4. Nếu tìm thấy: Cập nhật (append tokens + answers)
 *    Nếu không: Tạo mới
 */

  async processQuestionAnswer(
    question: string,
    answer: string,
    metadata: Record<string, any> = {}
  ): Promise<any> {
    try {
      console.log('\n' + '='.repeat(80));
      console.log('💬 PROCESS QUESTION & ANSWER (QDRANT INTEGRATION)');
      console.log('='.repeat(80));
      console.log(`❓ Câu hỏi: "${question}"`);
      console.log(`✅ Câu trả lời: "${answer}"`);

      // ========== BƯỚC 1: PHÂN TÍCH ANSWER VỚI UNDERTHESEA ==========
      console.log('\n=== BƯỚC 1: PHÂN TÍCH ANSWER (UNDERTHESEA.POS) ===');

      let newTokens: string[] = [];
      let newPosTags: string[] = [];

      try {
        const posResult = await firstValueFrom(
          this.undertheseaClient.send('underthesea.pos', { text: answer.trim() })
        );

        if (posResult && posResult.success) {
          const filtered = this.filterAndNormalizeTokens(
            posResult.tokens,
            posResult.pos_tags
          );
          newTokens = filtered.processedTokens;
          newPosTags = filtered.processedPosTags;

          console.log(`✅ Phân tích thành công: ${newTokens.length} tokens`);
          console.log(`   Tokens: [${newTokens.join(', ')}]`);
          console.log(`   POS Tags: [${newPosTags.join(', ')}]`);
        } else {
          throw new Error('POS analysis returned unsuccessful result');
        }
      } catch (error) {
        console.error('❌ Lỗi phân tích POS:', error.message);
        // Fallback: tách từ đơn giản
        newTokens = answer.trim().toLowerCase()
          .split(/\s+/)
          .filter(t => t.length > 0);
        newPosTags = new Array(newTokens.length).fill('X');
        console.log(`⚠️  Fallback: ${newTokens.length} tokens`);
      }

      if (newTokens.length === 0) {
        throw new BadRequestException('Không thể phân tích câu trả lời');
      }

      // ========== BƯỚC 2: TẠO EMBEDDING CHO QUESTION ==========
      console.log('\n=== BƯỚC 2: TẠO EMBEDDING CHO QUESTION ===');

      let questionEmbedding: number[] | null = null;

      try {
        questionEmbedding = await firstValueFrom(
          this.embeddingClient.send('embedding.generate', question.trim())
        );

        if (!questionEmbedding || !Array.isArray(questionEmbedding)) {
          throw new Error('Invalid embedding format');
        }

        console.log(`✅ Embedding created (dim: ${questionEmbedding.length})`);
      } catch (error) {
        console.error('❌ Embedding service error:', error.message);
        throw new InternalServerErrorException(
          'Cannot proceed without embedding service'
        );
      }

      // ========== BƯỚC 3: TÌM KIẾM TRONG QDRANT (SIMILARITY > 0.9) ==========
      console.log('\n=== BƯỚC 3: TÌM KIẾM TRONG QDRANT (THRESHOLD > 0.9) ===');

      let existingPoint = null;
      let isNewQuestion = true;

      try {
        // Gọi Qdrant search với vector embedding
        const searchResults = await firstValueFrom(
          this.qdrantClient.send('qdrant.find-similar-questions', {
            queryVector: questionEmbedding,
            limit: 10,
            minSimilarity: 0.9,
          })
        );

        console.log(`📊 Tìm thấy ${searchResults?.length || 0} kết quả`);

        if (searchResults && searchResults.length > 0) {
          // Lấy kết quả có score cao nhất
          const bestMatch = searchResults[0];

          console.log(`   Best match score: ${bestMatch.score?.toFixed(4) || 'N/A'}`);
          console.log(`   Question: "${bestMatch.payload?.question_text}"`);
          console.log(`   ID: ${bestMatch.id}`);

          // Kiểm tra score có thực sự > 0.9
          if (bestMatch.score && bestMatch.score > 0.9) {
            existingPoint = {
              id: bestMatch.id,
              score: bestMatch.score,
              payload: bestMatch.payload,
            };
            isNewQuestion = false;
            console.log('✅ Sẽ CẬP NHẬT vào question này');
          } else {
            console.log(`❌ Score ${bestMatch.score} <= 0.9, sẽ TẠO MỚI`);
          }
        } else {
          console.log('❌ Không tìm thấy question tương tự, sẽ TẠO MỚI');
        }
      } catch (error) {
        console.error('❌ Lỗi khi search Qdrant:', error.message);
        console.log('→ Sẽ tạo question mới');
        // Không throw error, tiếp tục tạo mới
      }

      // ========== BƯỚC 4: TẠO MỚI HOẶC CẬP NHẬT QDRANT ==========
      console.log('\n=== BƯỚC 4: ' + (isNewQuestion ? 'TẠO MỚI' : 'CẬP NHẬT') + ' QDRANT ===');

      let result;

      if (isNewQuestion) {
        result = await this.createNewQuestionInQdrant(
          question,
          answer,
          newTokens,
          newPosTags,
          questionEmbedding,
          metadata
        );
        console.log(`✅ Đã tạo mới trong Qdrant: ${newTokens.length} tokens, 1 answer`);
      } else {
        result = await this.updateExistingQuestionInQdrant(
          existingPoint,
          answer,
          newTokens,
          newPosTags,
          metadata
        );
        console.log(`✅ Đã cập nhật Qdrant: +${result.tokensAdded} tokens mới, tổng ${result.totalAnswers} answers, ${result.totalTokens} tokens`);
      }

      // ========== BƯỚC 5 (OPTIONAL): CẬP NHẬT NEO4J ==========
      console.log('\n=== BƯỚC 5: CẬP NHẬT NEO4J (OPTIONAL) ===');

      let neo4jResult = null;
      try {
        if (isNewQuestion) {
          // Tạo graph mới trong Neo4j
          neo4jResult = await this.saveQuestionWithTokens(
            question,
            answer,
            newTokens,
            newPosTags,
            metadata
          );
          console.log(`✅ Đã tạo Neo4j graph: ${neo4jResult.nodes?.length || 0} nodes, ${neo4jResult.relations?.length || 0} relations`);
        } else {
          // Chỉ thêm tokens MỚI vào Neo4j (không trùng lặp)
          const tokensToAdd = result.tokensAdded || 0;

          if (tokensToAdd > 0) {
            // result.newTokensArray chứa CHỈ các tokens chưa có (đã filter ở updateExistingQuestionInQdrant)
            neo4jResult = await this.addNewTokensToQuestionGraph(
              result.questionId,
              answer,
              result.newTokensArray || [],  // ← Chỉ tokens mới
              result.newPosTagsArray || [], // ← Chỉ POS tags mới
              metadata
            );
            console.log(`✅ Đã thêm ${tokensToAdd} tokens mới vào Neo4j`);
          } else {
            console.log('ℹ️  Không có token mới để thêm vào Neo4j (tất cả đã tồn tại)');
          }
        }
      } catch (error) {
        console.warn('⚠️  Neo4j update failed:', error.message);
        console.log('   Tiếp tục mà không có Neo4j graph (Qdrant vẫn đã lưu thành công)');
        // Không throw error - Neo4j là optional
      }

      // ========== TRẢ VỀ KẾT QUẢ ==========
      console.log('\n' + '='.repeat(80));
      console.log('✅ HOÀN THÀNH XỬ LÝ Q&A');
      console.log('='.repeat(80));
      console.log(`📊 Tóm tắt:`);
      console.log(`   - Operation: ${isNewQuestion ? 'CREATED' : 'UPDATED'}`);
      console.log(`   - Question ID: ${result.questionId}`);
      console.log(`   - Total answers: ${result.totalAnswers}`);
      console.log(`   - Total tokens: ${result.totalTokens}`);
      console.log(`   - Tokens added: ${result.tokensAdded || newTokens.length}`);
      if (neo4jResult) {
        console.log(`   - Neo4j: ${neo4jResult.nodes?.length || 0} nodes, ${neo4jResult.relations?.length || 0} relations`);
      }
      console.log('='.repeat(80));

      return {
        success: true,
        operation: isNewQuestion ? 'created' : 'updated',
        question: {
          id: result.questionId,
          text: question,
          isNew: isNewQuestion,
          similarity: existingPoint?.score || null,
        },
        answer: {
          text: answer,
          tokens: newTokens,
          posTags: newPosTags,
          tokenCount: newTokens.length,
        },
        qdrant: {
          questionId: result.questionId,
          totalAnswers: result.totalAnswers,
          totalTokens: result.totalTokens,
          tokensAdded: result.tokensAdded || newTokens.length,
        },
        neo4j: neo4jResult ? {
          nodes: neo4jResult.nodes?.length || 0,
          relations: neo4jResult.relations?.length || 0,
          success: true,
        } : {
          success: false,
          message: 'Neo4j update skipped or failed',
        },
        timestamp: new Date().toISOString(),
        metadata,
      };

    } catch (error) {
      console.error('❌ LỖI NGHIÊM TRỌNG trong processQuestionAnswer:', error);
      console.error('Stack trace:', error.stack);
      throw new InternalServerErrorException(
        `Không thể xử lý Q&A: ${error.message}`
      );
    }
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Tạo question mới trong Qdrant
   */
  private async createNewQuestionInQdrant(
    question: string,
    answer: string,
    tokens: string[],
    posTags: string[],
    embedding: number[],
    metadata: Record<string, any>
  ): Promise<any> {
    console.log('→ Tạo question mới trong Qdrant...');

    const questionId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const payload = {
      question_id: questionId,
      question_text: question,
      question_length: question.length,
      answer_text: [answer],
      answer_tokens_json: tokens,
      answer_posTags_json: posTags,
      answer_tokens_length: tokens.length,
      answer_posTags_length: posTags.length,
      answer_tokenCount: tokens.length,
      metadata_processedAt: new Date().toISOString(),
      metadata_version: '1.0',
      ...metadata,
    };

    console.log(`  → ID: ${questionId}`);
    console.log(`  → Payload: ${Object.keys(payload).length} fields`);
    console.log(`  → Vector dimension: ${embedding.length}`);

    try {
      // ✅ FIX: Gọi qdrantClient, KHÔNG phải neo4jClient
      const result = await firstValueFrom(
        this.qdrantClient.send('qdrant.upsert-question', {
          questionId: questionId,
          vector: embedding,
          payload: payload,
        }).pipe(timeout(10000))
      );

      console.log('  ✓ Qdrant upsert successful:', result);

      return {
        questionId,
        totalAnswers: 1,
        totalTokens: tokens.length,
        tokensAdded: tokens.length,
        newTokensArray: tokens,
        newPosTagsArray: posTags,
      };
    } catch (error) {
      console.error('  ❌ Qdrant upsert failed:', error);
      throw new InternalServerErrorException(
        `Failed to create question in Qdrant: ${error.message}`
      );
    }
  }
  /**
   * Cập nhật question đã tồn tại trong Qdrant
   */
  private async updateExistingQuestionInQdrant(
    existingPoint: any,
    newAnswer: string,
    newTokens: string[],
    newPosTags: string[],
    metadata: Record<string, any>
  ): Promise<any> {
    console.log('→ Cập nhật question trong Qdrant...');

    const questionId = existingPoint.id;
    const currentPayload = existingPoint.payload;

    console.log(`  → Question ID: ${questionId}`);

    // ========== 1. LẤY DỮ LIỆU HIỆN TẠI ==========
    const currentAnswers: string[] = Array.isArray(currentPayload.answer_text)
      ? currentPayload.answer_text
      : (currentPayload.answer_text ? [currentPayload.answer_text] : []);

    const currentTokens: string[] = Array.isArray(currentPayload.answer_tokens_json)
      ? currentPayload.answer_tokens_json
      : [];

    const currentPosTags: string[] = Array.isArray(currentPayload.answer_posTags_json)
      ? currentPayload.answer_posTags_json
      : [];

    console.log(`  📊 Hiện tại: ${currentAnswers.length} answers, ${currentTokens.length} tokens`);

    // ========== 2. BỔ SUNG ANSWER MỚI (KHÔNG THAY THẾ) ==========
    const updatedAnswers = [...currentAnswers, newAnswer];

    console.log(`  ➕ Thêm answer mới: "${newAnswer.substring(0, 50)}..."`);
    console.log(`  📈 Tổng answers: ${currentAnswers.length} → ${updatedAnswers.length}`);

    // ========== 3. TÌM VÀ BỔ SUNG TOKENS MỚI (KHÔNG TRÙNG LẶP) ==========
    const tokensToAdd: string[] = [];
    const posTagsToAdd: string[] = [];

    for (let i = 0; i < newTokens.length; i++) {
      const token = newTokens[i];
      const posTag = newPosTags[i];

      // Chỉ thêm token nếu chưa tồn tại
      if (!currentTokens.includes(token)) {
        tokensToAdd.push(token);
        posTagsToAdd.push(posTag);
        console.log(`    + Token mới: "${token}" (${posTag})`);
      }
    }

    // Tích lũy tokens: cũ + mới (không trùng)
    const updatedTokens = [...currentTokens, ...tokensToAdd];
    const updatedPosTags = [...currentPosTags, ...posTagsToAdd];

    console.log(`  ➕ Tokens mới: ${tokensToAdd.length}/${newTokens.length} (${newTokens.length - tokensToAdd.length} đã tồn tại)`);
    console.log(`  📈 Tổng tokens: ${currentTokens.length} → ${updatedTokens.length}`);

    // ========== 4. TẠO PAYLOAD BỔ SUNG (GIỮ NGUYÊN CÁC TRƯỜNG CŨ) ==========
    const updatedPayload = {
      ...currentPayload,  // ✅ Giữ nguyên TẤT CẢ các trường cũ

      // ✅ Cập nhật các mảng tích lũy
      answer_text: updatedAnswers,              // Thêm answer mới vào cuối
      answer_tokens_json: updatedTokens,        // Thêm tokens mới vào cuối
      answer_posTags_json: updatedPosTags,      // Thêm POS tags mới vào cuối

      // ✅ Cập nhật counts
      answer_tokens_length: updatedTokens.length,
      answer_posTags_length: updatedPosTags.length,
      answer_tokenCount: updatedTokens.length,

      // ✅ Cập nhật metadata (GIỮ metadata cũ, thêm lastUpdated)
      metadata_lastUpdated: new Date().toISOString(),
      ...metadata,  // Merge metadata mới vào (nếu có)
    };

    // ========== 5. GỬI UPDATE LÊN QDRANT ==========
    try {
      const result = await firstValueFrom(
        this.qdrantClient.send('qdrant.update-payload', {
          questionId: questionId,
          payload: updatedPayload,
        }).pipe(timeout(10000))
      );

      console.log('  ✓ Qdrant update successful');
      console.log(`  📦 Kết quả: ${updatedAnswers.length} answers, ${updatedTokens.length} tokens`);

      return {
        questionId,
        totalAnswers: updatedAnswers.length,
        totalTokens: updatedTokens.length,
        tokensAdded: tokensToAdd.length,
        newTokensArray: tokensToAdd,      // Chỉ trả về tokens MỚI THÊM
        newPosTagsArray: posTagsToAdd,    // Chỉ trả về POS tags MỚI THÊM
      };
    } catch (error) {
      console.error('  ❌ Qdrant update failed:', error);
      throw new InternalServerErrorException(
        `Failed to update question in Qdrant: ${error.message}`
      );
    }
  }

  /**
   * Thêm tokens mới vào Neo4j graph (optional)
   */
  private async addNewTokensToQuestionGraph(
    questionId: string,
    answer: string,
    newTokens: string[],
    newPosTags: string[],
    metadata: Record<string, any>
  ): Promise<any> {
    console.log('→ Cập nhật Neo4j graph...');

    try {
      // Lấy question node từ Neo4j
      const questionNode = await firstValueFrom(
        this.neo4jClient.send('neo4j.get-node', {
          label: 'Question',
          id: questionId,
        })
      );

      if (!questionNode) {
        console.warn('  ⚠️  Question node không tồn tại trong Neo4j');
        return null;
      }

      // Gọi hàm thêm tokens (đã có sẵn)
      return await this.addNewTokensToQuestion(
        questionNode,
        answer,
        newTokens,
        newPosTags,
        metadata
      );
    } catch (error) {
      console.error('  ❌ Neo4j update error:', error.message);
      throw error;
    }
  }

  // ========== HÀM TẠO QUESTION MỚI ==========
  private async createNewQuestion(
    question: string,
    answer: string,
    tokens: string[],
    posTags: string[],
    embedding: number[],
    metadata: Record<string, any>
  ): Promise<any> {
    console.log('→ Bắt đầu tạo question mới...');

    // 1. Tạo nodes trong Neo4j
    const neo4jResult = await this.saveQuestionWithTokens(
      question,
      answer,
      tokens,
      posTags,
      metadata
    );

    const questionId = neo4jResult.questionNode.id;
    console.log(`  ✓ Đã tạo Neo4j nodes (questionId: ${questionId})`);

    // 2. Tạo point trong Qdrant
    const qdrantPayload = {
      question_id: questionId,
      question_text: question,
      question_length: question.length,

      // Mảng chứa TẤT CẢ các answers
      answer_text: [answer],  // Mảng chứa các câu trả lời

      // Mảng tích lũy tokens từ TẤT CẢ answers
      answer_tokens_json: tokens,
      answer_posTags_json: posTags,
      answer_tokens_length: tokens.length,
      answer_posTags_length: posTags.length,
      answer_tokenCount: tokens.length,

      // Neo4j metadata
      neo4j_nodeCount: neo4jResult.nodes?.length || 0,
      neo4j_relationCount: neo4jResult.relations?.length || 0,

      // Timestamps
      metadata_processedAt: new Date().toISOString(),
      metadata_version: '1.0',
      ...metadata,
    };

    await firstValueFrom(
      this.qdrantClient.send('qdrant.upsert-question', {  // ← qdrantClient
        questionId: questionId,
        vector: embedding,
        payload: qdrantPayload,
      })
    );

    console.log(`  ✓ Đã tạo Qdrant point (${tokens.length} tokens, 1 answer)`);

    return {
      questionId,
      totalAnswers: 1,
      totalTokens: tokens.length,
      neo4j: neo4jResult,
    };
  }

  // ========== HÀM CẬP NHẬT QUESTION ĐÃ TỒN TẠI ==========
  private async updateExistingQuestion(
    existingQuestion: any,
    newAnswer: string,
    newTokens: string[],
    newPosTags: string[],
    metadata: Record<string, any>
  ): Promise<any> {
    console.log('→ Bắt đầu cập nhật question đã tồn tại...');

    const questionId = existingQuestion.questionNode.id;
    const currentPayload = existingQuestion.payload;

    // 1. Lấy dữ liệu hiện tại từ Qdrant payload
    const currentAnswers: string[] = Array.isArray(currentPayload.answer_text)
      ? currentPayload.answer_text
      : [currentPayload.answer_text];

    const currentTokens: string[] = Array.isArray(currentPayload.answer_tokens_json)
      ? currentPayload.answer_tokens_json
      : [];

    const currentPosTags: string[] = Array.isArray(currentPayload.answer_posTags_json)
      ? currentPayload.answer_posTags_json
      : [];

    console.log(`  📊 Dữ liệu hiện tại: ${currentAnswers.length} answers, ${currentTokens.length} tokens`);

    // 2. Tích lũy mới vào cũ
    const updatedAnswers = [...currentAnswers, newAnswer];

    // Tìm tokens mới chưa có
    const tokensToAdd: string[] = [];
    const posTagsToAdd: string[] = [];

    for (let i = 0; i < newTokens.length; i++) {
      if (!currentTokens.includes(newTokens[i])) {
        tokensToAdd.push(newTokens[i]);
        posTagsToAdd.push(newPosTags[i]);
      }
    }

    const updatedTokens = [...currentTokens, ...tokensToAdd];
    const updatedPosTags = [...currentPosTags, ...posTagsToAdd];

    console.log(`  ➕ Thêm: ${tokensToAdd.length} tokens mới, 1 answer mới`);
    console.log(`  📈 Tổng sau cập nhật: ${updatedTokens.length} tokens, ${updatedAnswers.length} answers`);

    // 3. Cập nhật Neo4j (nếu cần thêm relations mới)
    let neo4jResult = null;
    if (tokensToAdd.length > 0) {
      neo4jResult = await this.addNewTokensToQuestion(
        existingQuestion.questionNode,
        newAnswer,
        tokensToAdd,
        posTagsToAdd,
        metadata
      );
      console.log(`  ✓ Đã cập nhật Neo4j (${tokensToAdd.length} tokens mới)`);
    }

    // 4. Cập nhật Qdrant payload
    const updatedPayload = {
      ...currentPayload,

      // Cập nhật mảng answers
      answer_text: updatedAnswers,

      // Cập nhật mảng tokens tích lũy
      answer_tokens_json: updatedTokens,
      answer_posTags_json: updatedPosTags,
      answer_tokens_length: updatedTokens.length,
      answer_posTags_length: updatedPosTags.length,
      answer_tokenCount: updatedTokens.length,

      // Cập nhật timestamp
      metadata_processedAt: new Date().toISOString(),
      metadata_lastUpdated: new Date().toISOString(),
      ...metadata,
    };

    await firstValueFrom(
      this.qdrantClient.send('qdrant.update-payload', {  // ← qdrantClient
        questionId: questionId,
        payload: updatedPayload,
      })
    );

    console.log(`  ✓ Đã cập nhật Qdrant payload`);

    return {
      questionId,
      totalAnswers: updatedAnswers.length,
      totalTokens: updatedTokens.length,
      tokensAdded: tokensToAdd.length,
      neo4j: neo4jResult,
    };
  }

  /**
   * Thêm tokens mới vào câu hỏi đã tồn tại
   */
  private async addNewTokensToQuestion(
    questionNode: any,
    answer: string,
    newTokens: string[],
    newPosTags: string[],
    metadata: Record<string, any> = {}
  ): Promise<any> {
    try {
      const nodes = [];
      const relations = [];

      // 1. Lấy thông tin hiện tại
      const existingTokens = questionNode.properties?.accumulatedTokens
        ? JSON.parse(questionNode.properties.accumulatedTokens)
        : [];

      const answerCount = questionNode.properties?.answerCount || 0;
      const newAnswerVersion = answerCount + 1;

      // 2. Tạo node Answer mới cho câu trả lời này
      const answerNode = await this.createOrGetNode({
        label: 'Answer',
        name: `answer_${Date.now()}`,
        properties: {
          fullText: answer,
          tokens: JSON.stringify(newTokens),
          posTags: JSON.stringify(newPosTags),
          tokenCount: newTokens.length,
          ...metadata,
          type: 'answer',
          answerVersion: newAnswerVersion,
          createdAt: new Date().toISOString(),
        }
      });
      nodes.push(answerNode);

      // 3. Tạo quan hệ QUESTION_HAS_ANSWER
      const qaRelation = await this.createOrUpdateRelation({
        fromLabel: 'Question',
        fromName: questionNode.name,
        toLabel: 'Answer',
        toName: answerNode.name,
        relationType: this.determineRelationType('Question', 'Answer'),
        weight: 0.8, // Weight thấp hơn cho answer mới
        properties: {
          answerVersion: newAnswerVersion,
          ...metadata,
          createdAt: new Date().toISOString(),
        }
      });
      relations.push(qaRelation);

      // 4. Thêm tokens mới và kết nối
      for (let i = 0; i < newTokens.length; i++) {
        const token = newTokens[i];
        const posTag = newPosTags[i];

        // Tạo/tìm token node
        const tokenNode = await this.createOrGetNode({
          label: posTag,
          name: token,
          properties: {
            originalToken: token,
            fromQuestion: questionNode.name,
            addedInVersion: newAnswerVersion,
            ...metadata,
          }
        });
        nodes.push(tokenNode);

        // Tạo quan hệ QUESTION_HAS_TOKEN (chỉ nếu chưa có)
        const existingQtRelation = await firstValueFrom(
          this.neo4jClient.send('neo4j.get-relation', {
            fromLabel: 'Question',
            fromName: questionNode.name,
            toLabel: posTag,
            toName: token,
            relationType: this.determineRelationType('Question', posTag),
          })
        );

        if (!existingQtRelation) {
          const qtRelation = await this.createOrUpdateRelation({
            fromLabel: 'Question',
            fromName: questionNode.name,
            toLabel: posTag,
            toName: token,
            relationType: this.determineRelationType('Question', posTag),
            weight: 0.6, // Weight thấp hơn cho token mới
            properties: {
              addedInVersion: newAnswerVersion,
              ...metadata,
            }
          });
          relations.push(qtRelation);
        }

        // Tạo quan hệ ANSWER_CONTAINS_TOKEN
        const atRelation = await this.createOrUpdateRelation({
          fromLabel: 'Answer',
          fromName: answerNode.name,
          toLabel: posTag,
          toName: token,
          relationType: this.determineRelationType('Answer', posTag),
          weight: 0.7,
          properties: {
            positionInAnswer: i,
            ...metadata,
          }
        });
        relations.push(atRelation);
      }

      // 5. Cập nhật accumulatedTokens trong Question node
      const updatedTokens = [...existingTokens, ...newTokens];
      const uniqueTokens = [...new Set(updatedTokens)];

      await firstValueFrom(
        this.neo4jClient.send('neo4j.update-node-properties', {
          label: 'Question',
          name: questionNode.name,
          properties: {
            ...questionNode.properties,
            accumulatedTokens: JSON.stringify(uniqueTokens),
            tokenCount: uniqueTokens.length,
            answerCount: newAnswerVersion,
            lastUpdated: new Date().toISOString(),
          }
        })
      );

      return {
        success: true,
        questionNode,
        answerNode,
        nodes,
        relations,
        tokensAdded: newTokens,
      };

    } catch (error) {
      console.error('❌ Lỗi khi thêm tokens mới:', error);
      throw error;
    }
  }

  /**
   * Cập nhật Qdrant với tokens tích lũy
   */
  private async updateQdrantWithAccumulatedTokens(
    question: string,
    embedding: number[] | null,
    questionNode: any,
    neo4jResult: any,
    isNewQuestion: boolean
  ): Promise<any> {
    try {
      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        console.warn('⚠️  Không có embedding hợp lệ, bỏ qua Qdrant');
        return { success: false, reason: 'no_valid_embedding' };
      }

      // Lấy tất cả tokens tích lũy
      const accumulatedTokens = questionNode.properties?.accumulatedTokens
        ? JSON.parse(questionNode.properties.accumulatedTokens)
        : [];

      // Lấy tất cả answers
      const allAnswers = await this.getAllAnswersForQuestion(questionNode.id);

      const questionId = `qa_${questionNode.id}`;

      const payload = {
        question: {
          text: question.substring(0, 500),
          nodeId: questionNode.id,
          totalTokens: accumulatedTokens.length,
          answerCount: allAnswers.length,
        },
        accumulatedTokens: accumulatedTokens,
        answers: allAnswers.map((ans, idx) => ({
          id: ans.id,
          text: ans.fullText?.substring(0, 200) || ans.name,
          tokens: ans.tokens || [],
          version: ans.answerVersion || idx + 1,
          createdAt: ans.createdAt,
        })),
        statistics: {
          processedAt: new Date().toISOString(),
          tokenCount: accumulatedTokens.length,
          lastUpdate: new Date().toISOString(),
        }
      };

      const upsertResult = await firstValueFrom(
        this.qdrantClient.send('qdrant.upsert-question', {
          questionId,
          vector: embedding,
          payload,
        }).pipe(timeout(10000))
      );

      return {
        success: true,
        questionId,
        updated: !isNewQuestion,
        tokenCount: accumulatedTokens.length,
      };

    } catch (error) {
      console.error('❌ Lỗi khi cập nhật Qdrant:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Lấy tất cả câu trả lời cho một câu hỏi từ Neo4j
   */
  private async getAllAnswersForQuestion(questionNodeId: string): Promise<any[]> {
    try {
      const result = await firstValueFrom(
        this.neo4jClient.send('neo4j.get-answers-for-question', {
          questionNodeId,
        })
      );

      return result || [];
    } catch (error) {
      console.warn('⚠️  Không thể lấy danh sách câu trả lời:', error.message);

      // Fallback: nếu microservice chưa hỗ trợ, dùng query trực tiếp
      return await this.fallbackGetAnswersForQuestion(questionNodeId);
    }
  }

  /**
   * Fallback: Query trực tiếp nếu microservice chưa hỗ trợ
   */
  private async fallbackGetAnswersForQuestion(questionNodeId: string): Promise<any[]> {
    try {
      console.log(`🔄 Dùng fallback để lấy answers cho question: ${questionNodeId}`);

      // Sử dụng query Cypher trực tiếp qua neo4jClient
      const cypherQuery = `
      MATCH (q:Question)-[r:HAS_ANSWER]->(a:Answer)
      WHERE q.id = $questionNodeId OR q.name CONTAINS $questionNodeId
      RETURN a, r
      ORDER BY r.createdAt DESC
    `;

      const result = await firstValueFrom(
        this.neo4jClient.send('neo4j.execute-cypher', {
          query: cypherQuery,
          params: { questionNodeId }
        })
      );

      if (!result || !result.records || result.records.length === 0) {
        return [];
      }

      // Transform kết quả
      const answers = result.records.map((record: any) => {
        const answerNode = record.get('a');
        const relation = record.get('r');

        return {
          id: answerNode.properties.id || answerNode.identity.toString(),
          name: answerNode.properties.name || '',
          fullText: answerNode.properties.fullText || '',
          tokens: answerNode.properties.tokens ? JSON.parse(answerNode.properties.tokens) : [],
          posTags: answerNode.properties.posTags ? JSON.parse(answerNode.properties.posTags) : [],
          confidence: answerNode.properties.confidence || 0.5,
          answerVersion: answerNode.properties.answerVersion || 1,
          createdAt: answerNode.properties.createdAt || relation.properties.createdAt,
          properties: answerNode.properties,
        };
      });

      return answers;

    } catch (error) {
      console.error('❌ Fallback cũng thất bại:', error.message);
      return [];
    }
  }
  /**
   * Tạo câu hỏi mới với tokens
   */
  private async saveQuestionWithTokens(
    question: string,
    answer: string,
    tokens: string[],
    posTags: string[],
    metadata: Record<string, any> = {}
  ): Promise<any> {
    try {
      const nodes = [];
      const relations = [];

      // 1. Tạo node Question
      const questionNode = await this.createOrGetNode({
        label: 'Question',
        name: question.substring(0, 100),
        properties: {
          fullText: question,
          accumulatedTokens: JSON.stringify(tokens),
          tokenCount: tokens.length,
          ...metadata,
          type: 'question',
          createdAt: new Date().toISOString(),
        }
      });
      nodes.push(questionNode);

      // 2. Tạo node Answer (lưu câu trả lời cụ thể này)
      const answerNode = await this.createOrGetNode({
        label: 'Answer',
        name: `answer_${Date.now()}`,
        properties: {
          fullText: answer,
          tokens: JSON.stringify(tokens),
          posTags: JSON.stringify(posTags),
          tokenCount: tokens.length,
          ...metadata,
          type: 'answer',
          answerVersion: 1,
          createdAt: new Date().toISOString(),
        }
      });
      nodes.push(answerNode);

      // 3. Tạo quan hệ QUESTION_HAS_ANSWER
      const qaRelation = await this.createOrUpdateRelation({
        fromLabel: 'Question',
        fromName: questionNode.name,
        toLabel: 'Answer',
        toName: answerNode.name,
        relationType: this.determineRelationType('Question', 'Answer'),
        weight: 1.0,
        properties: {
          answerVersion: 1,
          ...metadata,
          createdAt: new Date().toISOString(),
        }
      });
      relations.push(qaRelation);

      // 4. Tạo tokens và kết nối với Question
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const posTag = posTags[i];

        // Tạo/tìm token node
        const tokenNode = await this.createOrGetNode({
          label: posTag,
          name: token,
          properties: {
            originalToken: token,
            fromQuestion: questionNode.name,
            ...metadata,
          }
        });
        nodes.push(tokenNode);

        // Tạo quan hệ QUESTION_HAS_TOKEN
        const qtRelation = await this.createOrUpdateRelation({
          fromLabel: 'Question',
          fromName: questionNode.name,
          toLabel: posTag,
          toName: token,
          relationType: this.determineRelationType('Question', posTag),
          weight: 1.0,
          properties: {
            tokenIndex: i,
            ...metadata,
          }
        });
        relations.push(qtRelation);

        // Tạo quan hệ ANSWER_CONTAINS_TOKEN
        const atRelation = await this.createOrUpdateRelation({
          fromLabel: 'Answer',
          fromName: answerNode.name,
          toLabel: posTag,
          toName: token,
          relationType: this.determineRelationType('Answer', posTag),
          weight: 0.8,
          properties: {
            positionInAnswer: i,
            ...metadata,
          }
        });
        relations.push(atRelation);
      }

      return {
        success: true,
        questionNode,
        answerNode,
        nodes,
        relations,
      };

    } catch (error) {
      console.error('❌ Lỗi khi tạo câu hỏi mới:', error);
      throw error;
    }
  }

  /**
   * Lưu câu trả lời vào Neo4j dưới dạng nodes và relations
   */
  private async saveAnswerToNeo4j(
    question: string,
    answer: string,
    tokens: string[],
    posTags: string[],
    metadata: Record<string, any> = {}
  ): Promise<any> {
    try {
      const nodes = [];
      const relations = [];

      // 1. Tạo node cho câu hỏi
      const questionNode = await this.createOrGetNode({
        label: 'Question',
        name: question.substring(0, 100), // Giới hạn độ dài
        properties: {
          fullText: question,
          tokenCount: tokens.length,
          ...metadata,
          type: 'question',
          createdAt: new Date().toISOString(),
        }
      });
      nodes.push(questionNode);

      // 2. Tạo node cho câu trả lời
      const answerNode = await this.createOrGetNode({
        label: 'Answer',
        name: answer.substring(0, 100),
        properties: {
          fullText: answer,
          tokenCount: tokens.length,
          tokens: JSON.stringify(tokens),
          posTags: JSON.stringify(posTags),
          ...metadata,
          type: 'answer',
          createdAt: new Date().toISOString(),
        }
      });
      nodes.push(answerNode);

      // 3. Tạo quan hệ QUESTION_HAS_ANSWER
      const qaRelation = await this.createOrUpdateRelation({
        fromLabel: 'Question',
        fromName: questionNode.name,
        toLabel: 'Answer',
        toName: answerNode.name,
        relationType: this.determineRelationType('Question', 'Answer'),
        weight: 1.0,
        properties: {
          confidence: 1.0,
          ...metadata,
          createdAt: new Date().toISOString(),
        }
      });
      relations.push(qaRelation);

      // 4. Tạo nodes cho từng token trong câu trả lời
      const tokenNodes = [];
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const posTag = posTags[i];

        // Tạo node cho token
        const tokenNode = await this.createOrGetNode({
          label: posTag,
          name: token,
          properties: {
            originalToken: token,
            position: i,
            inAnswer: answerNode.name,
            ...metadata,
          }
        });
        tokenNodes.push(tokenNode);
        nodes.push(tokenNode);

        // Tạo quan hệ ANSWER_CONTAINS_TOKEN
        const containsRelation = await this.createOrUpdateRelation({
          fromLabel: 'Answer',
          fromName: answerNode.name,
          toLabel: posTag,
          toName: token,
          relationType: this.determineRelationType('Answer', posTag),
          weight: 0.8 - (i * 0.1), // Giảm weight theo vị trí
          properties: {
            position: i,
            tokenIndex: i,
            ...metadata,
          }
        });
        relations.push(containsRelation);

        // Nếu không phải token đầu tiên, tạo quan hệ giữa các tokens
        if (i > 0) {
          const prevToken = tokens[i - 1];
          const prevPosTag = posTags[i - 1];

          const tokenRelation = await this.createOrUpdateRelation({
            fromLabel: prevPosTag,
            fromName: prevToken,
            toLabel: posTag,
            toName: token,
            relationType: this.determineRelationType(prevPosTag, posTag),
            weight: 0.7,
            properties: {
              sequence: `${i - 1}->${i}`,
              inAnswer: answerNode.name,
              ...metadata,
            }
          });
          relations.push(tokenRelation);
        }
      }

      // 5. Tạo quan hệ giữa các tokens (skip-gram style)
      if (tokenNodes.length >= 2) {
        for (let i = 0; i < tokenNodes.length; i++) {
          for (let j = Math.max(0, i - 2); j <= Math.min(tokenNodes.length - 1, i + 2); j++) {
            if (i !== j) {
              const distance = Math.abs(i - j);
              const weight = 0.6 / distance; // Weight giảm theo khoảng cách

              const skipGramRelation = await this.createOrUpdateRelation({
                fromLabel: posTags[i],
                fromName: tokens[i],
                toLabel: posTags[j],
                toName: tokens[j],
                relationType: this.determineRelationType(posTags[i], posTags[j]),
                weight: weight,
                properties: {
                  distance: distance,
                  inAnswer: answerNode.name,
                  windowSize: 2,
                  ...metadata,
                }
              });
              relations.push(skipGramRelation);
            }
          }
        }
      }

      return {
        success: true,
        questionNode,
        answerNode,
        answerNodeId: answerNode.id,
        tokenNodes,
        nodes,
        relations,
      };

    } catch (error) {
      console.error('❌ Lỗi khi lưu vào Neo4j:', error);
      throw error;
    }
  }

  /**
   * Tạo mới hoặc lấy node đã tồn tại trong Neo4j
   */
  private async createOrGetNode(params: {
    label: string;
    name: string;
    properties?: Record<string, any>;
  }): Promise<any> {
    try {
      // Thử lấy node đã tồn tại
      const existingNode = await firstValueFrom(
        this.neo4jClient.send('neo4j.get-node', {
          label: params.label,
          name: params.name,
        })
      );

      if (existingNode && existingNode.id) {
        // Cập nhật properties nếu node đã tồn tại
        if (params.properties) {
          await firstValueFrom(
            this.neo4jClient.send('neo4j.update-node-properties', {
              label: params.label,
              name: params.name,
              properties: params.properties,
            })
          );
        }
        return { ...existingNode, existed: true };
      }

      // Tạo node mới
      const newNode = await firstValueFrom(
        this.neo4jClient.send('neo4j.create-node', {
          label: params.label,
          name: params.name,
          properties: params.properties,
        })
      );

      return { ...newNode, existed: false };

    } catch (error) {
      console.error(`❌ Lỗi trong createOrGetNode:`, error);
      throw error;
    }
  }

  /**
   * Tạo mới hoặc cập nhật relation trong Neo4j
   */
  private async createOrUpdateRelation(params: {
    fromLabel: string;
    fromName: string;
    toLabel: string;
    toName: string;
    relationType: string;
    weight: number;
    properties?: Record<string, any>;
  }): Promise<any> {
    try {
      // Kiểm tra relation đã tồn tại
      const existingRelation = await firstValueFrom(
        this.neo4jClient.send('neo4j.get-relation', {
          fromLabel: params.fromLabel,
          fromName: params.fromName,
          toLabel: params.toLabel,
          toName: params.toName,
          relationType: params.relationType,
        })
      );

      if (existingRelation && existingRelation.id) {
        // Cập nhật weight và properties
        const updatedWeight = existingRelation.weight
          ? (existingRelation.weight + params.weight) / 2 // Trung bình cộng
          : params.weight;

        const updatedRelation = await firstValueFrom(
          this.neo4jClient.send('neo4j.update-relation-weight', {
            fromLabel: params.fromLabel,
            fromName: params.fromName,
            toLabel: params.toLabel,
            toName: params.toName,
            relationType: params.relationType,
            weight: updatedWeight,
            properties: {
              ...existingRelation.properties,
              ...params.properties,
              updatedAt: new Date().toISOString(),
              updateCount: (existingRelation.properties?.updateCount || 0) + 1,
            },
          })
        );

        return { ...updatedRelation, existed: true, action: 'updated' };
      }

      // Tạo relation mới
      const newRelation = await firstValueFrom(
        this.neo4jClient.send('neo4j.create-relation', {
          fromLabel: params.fromLabel,
          fromName: params.fromName,
          toLabel: params.toLabel,
          toName: params.toName,
          relationType: params.relationType,
          weight: params.weight,
          properties: {
            ...params.properties,
            createdAt: new Date().toISOString(),
          },
        })
      );

      return { ...newRelation, existed: false, action: 'created' };

    } catch (error) {
      console.error(`❌ Lỗi trong createOrUpdateRelation:`, error);
      throw error;
    }
  }

  // ==================== HÀM PHỤ TRỢ: saveToQdrant ====================
  /**
   * Lưu câu hỏi và câu trả lời vào Qdrant
   */
  private async saveToQdrant(
    question: string,
    questionEmbedding: number[] | null,
    answer: string,
    answerTokens: string[],
    answerPosTags: string[],
    metadata: Record<string, any> = {},
    neo4jResult: any
  ): Promise<any> {
    try {
      // ✅ Kiểm tra embedding trước khi lưu
      if (!questionEmbedding || !Array.isArray(questionEmbedding) || questionEmbedding.length === 0) {
        console.warn('⚠️  Không có embedding hợp lệ, bỏ qua Qdrant');
        return {
          success: false,
          reason: 'no_valid_embedding',
          questionId: null
        };
      }

      // ✅ Validate vector values
      const hasInvalidValues = questionEmbedding.some(v =>
        v === null || v === undefined || isNaN(v) || !isFinite(v)
      );

      if (hasInvalidValues) {
        console.error('❌ Embedding chứa giá trị không hợp lệ (NaN/Infinity)');
        return {
          success: false,
          reason: 'invalid_embedding_values',
          questionId: null
        };
      }

      const questionId = `qa_${Date.now()}_${Buffer.from(question).toString('base64').substring(0, 16)}`;

      // ✅ Giảm payload size - chỉ lưu thông tin cần thiết
      const payload = {
        question: {
          text: question.substring(0, 500), // Giới hạn độ dài
          length: question.length,
        },
        answer: {
          text: answer.substring(0, 500), // Giới hạn độ dài
          tokens: answerTokens.slice(0, 50), // Giới hạn số token
          posTags: answerPosTags.slice(0, 50),
          tokenCount: answerTokens.length,
        },
        neo4j: {
          answerNodeId: neo4jResult.answerNodeId,
          nodeCount: neo4jResult.nodes?.length || 0,
          relationCount: neo4jResult.relations?.length || 0,
        },
        metadata: {
          processedAt: new Date().toISOString(),
          version: '1.0',
        }
      };

      // ✅ Gọi với error handling tốt hơn
      const upsertResult = await firstValueFrom(
        this.qdrantClient.send('qdrant.upsert-question', {
          questionId,
          vector: questionEmbedding,
          payload: payload,
        }).pipe(
          timeout(10000), // 10s timeout
        )
      );

      console.log('✅ Đã lưu vào Qdrant:', questionId);

      return {
        success: true,
        questionId,
        collection: 'qa_pairs',
        vectorSize: questionEmbedding.length,
      };

    } catch (error) {
      console.error('❌ Lỗi khi lưu vào Qdrant:', error.message);
      console.error('Stack:', error.stack);

      // ✅ Không throw error để không ảnh hưởng flow chính
      return {
        success: false,
        error: error.message,
        questionId: null
      };
    }
  }
  // ========== HELPER FUNCTIONS ==========

  /**
   * Lọc và chuẩn hóa tokens
   */
  private filterAndNormalizeTokens(tokens: string[], pos_tags: any[]) {
    const PRONOUNS = new Set([
      'tôi', 'tui', 'tao', 'tớ', 'mình', 'chúng tôi', 'chúng ta',
      'bạn', 'mày', 'cậu', 'họ', 'nó', 'hắn',
      'anh', 'chị', 'em', 'ông', 'bà', 'cháu'
    ]);

    const EXCLUDED_POS = new Set(['CH', 'M', 'FW']);
    const PUNCTUATIONS = new Set(['?', '!', '.', ',', ';', ':', '-', '(', ')', '[', ']']);

    const processedTokens = [];
    const processedPosTags = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i].toLowerCase().trim();
      let posTag = Array.isArray(pos_tags[i]) ? pos_tags[i][1] : pos_tags[i];

      if (!token || PUNCTUATIONS.has(token) || EXCLUDED_POS.has(posTag)) {
        continue;
      }

      if (PRONOUNS.has(token)) {
        posTag = 'P';
      }

      processedTokens.push(token);
      processedPosTags.push(posTag);
    }

    return { processedTokens, processedPosTags };
  }

  /**
   * Lấy candidates từ Neo4j Graph
   */
  private async retrieveGraphCandidates(tokens: string[], posTags: string[]) {
    const candidates = [];

    for (let i = 0; i < tokens.length - 1; i++) {
      const currentToken = tokens[i];
      const nextToken = tokens[i + 1];
      const currentTag = posTags[i];
      const nextTag = posTags[i + 1];

      try {
        const suggestions = await firstValueFrom(
          this.neo4jClient.send('neo4j.get-suggestions', {
            word: currentToken,
            limit: 10
          })
        );

        if (suggestions && suggestions.length > 0) {
          candidates.push({
            fromToken: currentToken,
            fromTag: currentTag,
            toToken: nextToken,
            toTag: nextTag,
            suggestions,
            position: i,
          });
        }
      } catch (error) {
        console.warn(`⚠️  Failed to get suggestions for "${currentToken}"`);
      }
    }

    return candidates;
  }

  /**
   * Re-rank candidates với PhoBERT
   */
  private async rerankWithPhoBERT(context: string, candidates: any[], tokens: string[]) {
    const reranked = [];

    for (const candidate of candidates) {
      const { fromToken, suggestions, position } = candidate;

      // Tạo context window
      const contextStart = Math.max(0, position - 3);
      const contextEnd = Math.min(tokens.length, position + 4);
      const localContext = tokens.slice(contextStart, contextEnd).join(' ');

      const candidateWords = suggestions.map(s =>
        s.suggestion || s.word || s.toWord
      ).filter(Boolean);

      try {
        const phobertScores = await this.scoreWithPhoBERT(
          localContext,
          candidateWords,
          10
        );

        const scored = suggestions.map(sug => {
          const word = (sug.suggestion || sug.word || sug.toWord).toLowerCase();
          const phobertScore = phobertScores.find(p => p.word.toLowerCase() === word)?.score || 0;
          const neo4jScore = sug.score || sug.weight || 0;

          return {
            ...sug,
            word,
            neo4jScore,
            phobertScore,
            finalScore: this.mergeScores(neo4jScore, phobertScore),
            fromToken,
            position,
          };
        });

        scored.sort((a, b) => b.finalScore - a.finalScore);
        reranked.push(...scored.slice(0, 5));

      } catch (error) {
        console.warn(`⚠️  PhoBERT failed for position ${position}`);
        reranked.push(...suggestions.slice(0, 3));
      }
    }

    return reranked;
  }

  /**
   * Phân bố các từ vào 5 nhóm ngữ nghĩa
   */
  private clusterIntoFiveNodes(results: any[]) {
    const clusters = {
      noun: [],      // Danh từ
      verb: [],      // Động từ
      adjective: [], // Tính từ
      pronoun: [],   // Đại từ
      other: [],     // Khác
    };

    for (const result of results) {
      const posTag = result.toLabel || result.posTag || 'X';

      if (posTag.startsWith('N')) {
        clusters.noun.push(result);
      } else if (posTag.startsWith('V')) {
        clusters.verb.push(result);
      } else if (posTag.startsWith('A')) {
        clusters.adjective.push(result);
      } else if (posTag === 'P') {
        clusters.pronoun.push(result);
      } else {
        clusters.other.push(result);
      }
    }

    return {
      clusters: [
        { type: 'noun', items: clusters.noun.slice(0, 10) },
        { type: 'verb', items: clusters.verb.slice(0, 10) },
        { type: 'adjective', items: clusters.adjective.slice(0, 10) },
        { type: 'pronoun', items: clusters.pronoun.slice(0, 10) },
        { type: 'other', items: clusters.other.slice(0, 10) },
      ]
    };
  }

  /**
   * Tạo gợi ý câu hỏi
   */
  private generateSuggestions(clusteredResults: any, tokens: string[]) {
    const suggestions = [];

    // Gợi ý hoàn chỉnh câu
    for (const cluster of clusteredResults.clusters) {
      if (cluster.items.length > 0) {
        suggestions.push({
          type: 'complete',
          category: cluster.type,
          words: cluster.items.slice(0, 5).map(item => item.word),
        });
      }
    }

    // Gợi ý về chủ đề
    const lastToken = tokens[tokens.length - 1];
    suggestions.push({
      type: 'topic',
      baseWord: lastToken,
      words: clusteredResults.clusters
        .flatMap(c => c.items)
        .slice(0, 10)
        .map(item => item.word),
    });

    // Gợi ý mở rộng
    suggestions.push({
      type: 'expansion',
      words: ['thế nào', 'như thế nào', 'ra sao', 'không', 'được'],
    });

    return suggestions;
  }

  /**
   * Lưu nodes và relations vào Neo4j
   */
  private async saveToNeo4j(tokens: string[], posTags: string[], results: any[]) {
    const nodes = [];
    const relations = [];

    // Tạo nodes
    for (let i = 0; i < tokens.length; i++) {
      try {
        const node = await firstValueFrom(
          this.neo4jClient.send('neo4j.create-node', {
            label: posTags[i],
            name: tokens[i],
          })
        );

        nodes.push({
          token: tokens[i],
          posTag: posTags[i],
          node,
        });
      } catch (error) {
        console.warn(`⚠️  Failed to create node for "${tokens[i]}"`);
      }
    }

    // Tạo relations
    for (let i = 0; i < tokens.length - 1; i++) {
      const relationType = this.determineRelationType(posTags[i], posTags[i + 1]);

      try {
        const relation = await firstValueFrom(
          this.neo4jClient.send('neo4j.create-relation', {
            fromLabel: posTags[i],
            fromName: tokens[i],
            toLabel: posTags[i + 1],
            toName: tokens[i + 1],
            relationType,
            weight: 0.5,
          })
        );

        relations.push(relation);
      } catch (error) {
        console.warn(`⚠️  Failed to create relation: ${tokens[i]} -> ${tokens[i + 1]}`);
      }
    }

    return { nodes, relations };
  }

  /**
   * Chuẩn hóa weights cho tất cả nodes
   */
  private async normalizeAllWeights(nodes: any[]) {
    for (const node of nodes) {
      try {
        await this.normalizeWeightsForNode(node.posTag, node.token);
      } catch (error) {
        console.warn(`⚠️  Failed to normalize weights for ${node.token}`);
      }
    }
  }
  // ========== HÀM 1: Chuẩn hóa CHO 1 NODE CỤ THỂ (có tham số) ==========
  private async normalizeWeightsForNode(fromLabel: string, fromName: string): Promise<void> {
    try {
      console.log(`🔄 Chuẩn hóa weights cho node: ${fromLabel}:${fromName}`);

      // Lấy TẤT CẢ relations từ node này
      const relations = await firstValueFrom(
        this.neo4jClient.send('neo4j.get-relations-from-node', {
          label: fromLabel,
          name: fromName,
        })
      );

      if (!relations || relations.length === 0) {
        console.log('⚠️  Không có relation nào từ node này');
        return;
      }

      console.log(`  📊 Tìm thấy ${relations.length} relations từ node này`);

      // Nếu chỉ có 1 relation, set về 1.0
      if (relations.length === 1) {
        await firstValueFrom(
          this.neo4jClient.send('neo4j.update-relation-weight', {
            fromLabel,
            fromName,
            toLabel: relations[0].toLabel,
            toName: relations[0].toName,
            relationType: relations[0].relationType,
            weight: 1.0,
          })
        );
        console.log(`  ✅ Chỉ có 1 relation, set weight = 1.0`);
        return;
      }

      // Lấy min/max trong nhóm này
      const weights = relations
        .filter(r => r.weight !== undefined && !isNaN(r.weight) && isFinite(r.weight))
        .map(r => r.weight);

      if (weights.length === 0) {
        console.warn('  ⚠️  Không có weight hợp lệ');
        return;
      }

      const minWeight = Math.min(...weights);
      const maxWeight = Math.max(...weights);
      const range = maxWeight - minWeight;

      console.log(`  📈 Range: [${minWeight.toFixed(4)}, ${maxWeight.toFixed(4)}]`);

      // Nếu tất cả weights bằng nhau
      if (range < 0.0001) {
        console.log(`  ⚠️  Tất cả weights bằng nhau, set tất cả về 0.5`);
        for (const rel of relations) {
          await firstValueFrom(
            this.neo4jClient.send('neo4j.update-relation-weight', {
              fromLabel,
              fromName,
              toLabel: rel.toLabel,
              toName: rel.toName,
              relationType: rel.relationType,
              weight: 0.5,
            })
          );
        }
        return;
      }

      // ✅ Chuẩn hóa Min-Max cho nhóm này
      const updates = [];
      for (const rel of relations) {
        if (rel.weight === undefined || isNaN(rel.weight) || !isFinite(rel.weight)) {
          continue;
        }

        const normalizedWeight = (rel.weight - minWeight) / range;
        const clampedWeight = Math.max(0, Math.min(1, normalizedWeight));

        updates.push({
          fromLabel,
          fromName,
          toLabel: rel.toLabel,
          toName: rel.toName,
          relationType: rel.relationType,
          weight: Number(clampedWeight.toFixed(6)),
        });
      }

      // Batch update
      if (updates.length > 0) {
        await firstValueFrom(
          this.neo4jClient.send('neo4j.batch-update-weights', { updates })
        );
        console.log(`  ✅ Đã chuẩn hóa ${updates.length} relations`);
      }

    } catch (error) {
      console.error(`❌ Lỗi khi chuẩn hóa node ${fromLabel}:${fromName}:`, error.message);
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
  // ========== FIXED: calculateWeightIncrement ==========
  // Chuẩn hóa wieght của các nút liên quan sau khi weight của 1 nút khác đã được tăng
  //Ví dụ tôi->yêu (weight=0.8), tôi->thương (weight=0.3), tôi->ghét (weight=0.2), tôi->rất (weight=0.1)  thì khi tôi->yêu được tăng lên 0.9,
  //thì tôi->thương và tôi->ghét, tôi->rất sẽ bị giảm xuống theo nguyên tắc chuẩn hóa về 0.5.
  private async calculateWeightIncrement(params: {
    fromLabel: string;
    fromName: string;
    toLabel: string;
    toName: string;
    currentWeight: number;
  }): Promise<number> {
    let { fromLabel, fromName, toLabel, toName, currentWeight } = params;

    // ✅ Validation
    if (currentWeight === undefined || currentWeight === null ||
      isNaN(currentWeight) || !isFinite(currentWeight)) {
      console.warn(`⚠️  Invalid currentWeight for ${fromName}->${toName}, using 0`);
      currentWeight = 0;
    }

    // 1️⃣ Base increment - giảm xuống để tránh tăng trưởng nổ
    let increment = 0.2; // ✅ Giảm từ 0.5 → 0.2

    // 2️⃣ Lấy tất cả relations từ cùng node gốc
    const siblingRelations = await firstValueFrom(
      this.neo4jClient.send('neo4j.get-relations-from-node', {
        label: fromLabel,
        name: fromName,
      })
    );

    if (siblingRelations && siblingRelations.length > 0) {
      const siblingWeights = siblingRelations
        .filter(r => r.weight !== undefined && !isNaN(r.weight) && isFinite(r.weight))
        .map(r => r.weight);

      if (siblingWeights.length > 0) {
        const avgSiblingWeight = siblingWeights.reduce((sum, w) => sum + w, 0) / siblingWeights.length;

        // ✅ FIXED: Tránh giá trị âm, dùng công thức an toàn hơn
        const ratio = currentWeight / (avgSiblingWeight + 0.01);

        if (ratio < 1) {
          // Relation yếu hơn trung bình → tăng nhiều hơn
          increment *= (1 + (1 - ratio) * 0.3); // Max boost = 1.3x
        } else {
          // Relation mạnh hơn trung bình → tăng ít hơn
          increment *= 1 / (1 + Math.log(ratio + 1) * 0.3); // Giảm dần theo log
        }

        console.log(`  🔗 Sibling context: avg=${avgSiblingWeight.toFixed(4)}, ratio=${ratio.toFixed(2)}, increment=${increment.toFixed(4)}`);
      }
    }

    // 3️⃣ Popularity boost cho target node
    const incomingRelations = await firstValueFrom(
      this.neo4jClient.send('neo4j.get-relations-to-node', {
        label: toLabel,
        name: toName,
      })
    );

    if (incomingRelations && incomingRelations.length > 1) {
      const popularityBoost = Math.log(incomingRelations.length + 1) * 0.1; // ✅ Giảm từ 0.2 → 0.1
      increment *= (1 + popularityBoost);
      console.log(`  ⭐ Target popularity: ${incomingRelations.length} incoming, boost=${popularityBoost.toFixed(4)}`);
    }

    // ✅ Limit increment trong khoảng an toàn
    increment = Math.min(Math.max(increment, 0.05), 1.0); // [0.05, 1.0]

    return increment;
  }

  /**
 * Duyệt qua tất cả các node có label "P" và xóa những node không phải đại từ hợp lệ
 * @returns Thống kê về số node đã kiểm tra và xóa
 */
  async cleanInvalidPronounNodes() {
    console.log('='.repeat(80));
    console.log('🧹 BẮT ĐẦU KIỂM TRA VÀ XÓA CÁC NODE "P" KHÔNG HỢP LỆ');
    console.log('='.repeat(80));

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

    const stats = {
      totalChecked: 0,
      validNodes: 0,
      invalidNodes: 0,
      deletedNodes: 0,
      errors: [],
      invalidList: [],
    };

    try {
      // Bước 1: Lấy tất cả các node có label "P"
      console.log('📊 Đang lấy danh sách tất cả các node có label "P"...');

      const allPronounNodes = await firstValueFrom(
        this.neo4jClient.send('neo4j.get-nodes-by-label', { label: 'P' })
      );

      if (!allPronounNodes || allPronounNodes.length === 0) {
        console.log('ℹ️  Không tìm thấy node nào có label "P"');
        return stats;
      }

      stats.totalChecked = allPronounNodes.length;
      console.log(`✅ Tìm thấy ${stats.totalChecked} node có label "P"`);
      console.log('');

      // Bước 2: Phân loại các node
      const validNodes: string[] = [];
      const invalidNodes: string[] = [];

      console.log('🔍 Đang kiểm tra tính hợp lệ của từng node...');
      console.log('-'.repeat(60));

      for (let i = 0; i < allPronounNodes.length; i++) {
        const node = allPronounNodes[i];
        const nodeName = node.name ? node.name.toLowerCase() : '';

        console.log(`[${i + 1}/${allPronounNodes.length}] Kiểm tra: "${node.name}"`);

        if (PRONOUNS.has(nodeName)) {
          stats.validNodes++;
          validNodes.push(node.name);
          console.log(`  ✅ HỢP LỆ - Giữ lại`);
        } else {
          stats.invalidNodes++;
          invalidNodes.push(node.name);
          stats.invalidList.push(node.name);
          console.log(`  ❌ KHÔNG HỢP LỆ - Đánh dấu xóa`);
        }
      }

      console.log('');
      console.log(`📋 Tổng kết phân loại:`);
      console.log(`  ✅ Hợp lệ: ${stats.validNodes} nodes`);
      console.log(`  ❌ Không hợp lệ: ${stats.invalidNodes} nodes`);
      console.log('');

      // Bước 3: Xóa batch các node không hợp lệ
      if (invalidNodes.length > 0) {
        console.log(`🗑️  Đang xóa ${invalidNodes.length} nodes không hợp lệ...`);

        try {
          const deleteResult = await firstValueFrom(
            this.neo4jClient.send('neo4j.delete-nodes-batch', {
              label: 'P',
              names: invalidNodes,
            })
          );

          stats.deletedNodes = deleteResult.deletedCount || 0;

          if (stats.deletedNodes === invalidNodes.length) {
            console.log(`✅ Đã xóa thành công ${stats.deletedNodes} nodes`);
          } else {
            console.warn(`⚠️  Chỉ xóa được ${stats.deletedNodes}/${invalidNodes.length} nodes`);

            // Ghi lại các node không xóa được
            const deletedSet = new Set(invalidNodes.slice(0, stats.deletedNodes));
            const failedDeletes = invalidNodes.filter(name => !deletedSet.has(name));

            failedDeletes.forEach(name => {
              stats.errors.push({
                node: name,
                error: 'Không xóa được node',
              });
            });
          }
        } catch (error) {
          console.error(`❌ Lỗi khi xóa batch:`, error.message);
          stats.errors.push({
            node: 'batch',
            error: error.message,
          });
        }
      } else {
        console.log('✅ Không có node nào cần xóa');
      }

      // Bước 4: Tổng kết
      console.log('');
      console.log('='.repeat(80));
      console.log('📊 KẾT QUẢ KIỂM TRA VÀ DỌN DẸP');
      console.log('='.repeat(80));
      console.log(`✅ Tổng số node đã kiểm tra: ${stats.totalChecked}`);
      console.log(`✅ Node hợp lệ (giữ lại): ${stats.validNodes}`);
      console.log(`❌ Node không hợp lệ: ${stats.invalidNodes}`);
      console.log(`🗑️  Node đã xóa thành công: ${stats.deletedNodes}`);
      console.log(`⚠️  Lỗi: ${stats.errors.length}`);
      console.log('');

      if (stats.invalidList.length > 0) {
        console.log('📋 DANH SÁCH CÁC NODE KHÔNG HỢP LỆ:');
        stats.invalidList.forEach((name, idx) => {
          const status = idx < stats.deletedNodes ? '✅ Đã xóa' : '❌ Chưa xóa';
          console.log(`  ${idx + 1}. "${name}" - ${status}`);
        });
        console.log('');
      }

      if (stats.errors.length > 0) {
        console.log('⚠️  DANH SÁCH LỖI:');
        stats.errors.forEach((err, idx) => {
          console.log(`  ${idx + 1}. "${err.node}": ${err.error}`);
        });
      }

      console.log('='.repeat(80));

      return stats;

    } catch (error) {
      console.error('❌ Lỗi nghiêm trọng khi dọn dẹp node "P":', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      throw new InternalServerErrorException(`Không thể dọn dẹp node "P": ${error.message}`);
    }
  }

  /**
   * Kiểm tra một node cụ thể có phải đại từ hợp lệ không
   */
  isValidPronoun(nodeName: string): boolean {
    const PRONOUNS = new Set([
      'tôi', 'tui', 'tao', 'tớ', 'mình', 'chúng tôi', 'chúng ta', 'chúng mình',
      'bạn', 'mày', 'cậu', 'các bạn', 'quý vị',
      'họ', 'nó', 'hắn', 'y', 'chúng nó',
      'anh', 'chị', 'em', 'ông', 'bà', 'cháu',
      'bố', 'ba', 'tía', 'con', 'mẹ', 'má',
      'chú', 'bác', 'cô', 'dì'
    ]);

    return PRONOUNS.has(nodeName.toLowerCase());
  }

  /**
   * Lấy danh sách tất cả các node "P" không hợp lệ (không xóa)
   */
  async getInvalidPronounNodes() {
    try {
      const allPronounNodes = await firstValueFrom(
        this.neo4jClient.send('neo4j.get-nodes-by-label', { label: 'P' })
      );

      if (!allPronounNodes || allPronounNodes.length === 0) {
        return {
          success: true,
          total: 0,
          validCount: 0,
          invalidCount: 0,
          invalidNodes: [],
        };
      }

      const invalidNodes = allPronounNodes.filter(node =>
        !this.isValidPronoun(node.name)
      );

      return {
        success: true,
        total: allPronounNodes.length,
        validCount: allPronounNodes.length - invalidNodes.length,
        invalidCount: invalidNodes.length,
        invalidNodes: invalidNodes.map(n => ({
          name: n.name,
          labels: n.labels,
        })),
      };
    } catch (error) {
      console.error('Lỗi khi lấy danh sách node "P" không hợp lệ:', error);
      throw new InternalServerErrorException('Không thể lấy danh sách node không hợp lệ');
    }
  }

  //Thống kê chi tiết về các node "P"
  async getPronounStatistics() {
    try {
      const total = await firstValueFrom(
        this.neo4jClient.send('neo4j.count-nodes-by-label', { label: 'P' })
      );

      const invalidResult = await this.getInvalidPronounNodes();

      return {
        success: true,
        total,
        valid: invalidResult.validCount,
        invalid: invalidResult.invalidCount,
        invalidList: invalidResult.invalidNodes.map(n => n.name),
      };
    } catch (error) {
      console.error('Lỗi khi lấy thống kê đại từ:', error);
      throw new InternalServerErrorException('Không thể lấy thống kê đại từ');
    }
  }
}