import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { NlpIntegrationService } from '../services/nlp-integration.service';

@Controller('nlp')
export class NlpController {
    constructor(private readonly nlpService: NlpIntegrationService) { }

    // Phân tích văn bản và tạo graph đơn giản
    @Post('analyze')
    async analyzeText(
        @Body('text') text: string,
        @Body('createRelations') createRelations?: boolean,
    ) {
        if (!text) {
            return { error: 'Thiếu tham số text' };
        }
        return await this.nlpService.analyzeAndCreateGraph(text, createRelations ?? true);
    }

    /**
     * Phân tích văn bản và tạo semantic graph (có quan hệ ngữ nghĩa)
     * 
     * Ví dụ: "Sinh viên học bài tập khó"
     * Sẽ tạo các quan hệ như:
     * - Sinh viên (N) --SUBJECT_OF--> học (V)
     * - học (V) --HAS_OBJECT--> bài tập (N)
     * - khó (A) --MODIFIES--> bài tập (N)
     */
    @Post('analyze-semantic')
    async analyzeSemanticText(@Body('text') text: string) {
        console.log('Received text for semantic analysis:', text);
        if (!text) {
            return { error: 'Thiếu tham số text' };
        }
        return await this.nlpService.analyzeAndCreateSemanticGraph(text);
    }

    // 3. Thêm endpoint vào controller
    @Post('batch-process')
    async batchProcess(@Query('folder') folder?: string) {
        const folderPath = folder || 'data_test/test/pos';
        return await this.nlpService.processBatchFiles(folderPath);
    }


    // ========== ENDPOINT ĐỂ XEM THỐNG KÊ WEIGHT ==========
    // @Get('weight-statistics')
    // async getWeightStatistics() {
    //   try {
    //     const allRelations = await firstValueFrom(
    //       this.neo4jClient.send('neo4j.get-all-relations', {})
    //     );

    //     const weights = allRelations
    //       .filter(r => r.weight !== undefined)
    //       .map(r => r.weight)
    //       .sort((a, b) => a - b);

    //     if (weights.length === 0) {
    //       return { message: 'Chưa có relation nào' };
    //     }

    //     const sum = weights.reduce((acc, w) => acc + w, 0);
    //     const mean = sum / weights.length;
    //     const median = weights.length % 2 === 0
    //       ? (weights[weights.length / 2 - 1] + weights[weights.length / 2]) / 2
    //       : weights[Math.floor(weights.length / 2)];

    //     return {
    //       total: weights.length,
    //       min: weights[0],
    //       max: weights[weights.length - 1],
    //       mean: Number(mean.toFixed(4)),
    //       median: Number(median.toFixed(4)),
    //       distribution: {
    //         '0.0-0.2': weights.filter(w => w < 0.2).length,
    //         '0.2-0.4': weights.filter(w => w >= 0.2 && w < 0.4).length,
    //         '0.4-0.6': weights.filter(w => w >= 0.4 && w < 0.6).length,
    //         '0.6-0.8': weights.filter(w => w >= 0.6 && w < 0.8).length,
    //         '0.8-1.0': weights.filter(w => w >= 0.8).length,
    //       },
    //       top10: allRelations
    //         .sort((a, b) => b.weight - a.weight)
    //         .slice(0, 10)
    //         .map(r => ({
    //           from: r.fromName,
    //           to: r.toName,
    //           type: r.relationType,
    //           weight: r.weight,
    //         })),
    //     };
    //   } catch (error) {
    //     console.error('Lỗi khi lấy thống kê:', error);
    //     throw new InternalServerErrorException('Không thể lấy thống kê weight');
    //   }
    // }
    /**
     * Xây dựng knowledge graph từ nhiều văn bản
     * 
     * Sử dụng để xây dựng knowledge graph từ corpus lớn.
     * Weight sẽ tự động tăng khi các mối quan hệ xuất hiện nhiều lần.
     */
    @Post('build-knowledge-graph')
    async buildKnowledgeGraph(@Body('texts') texts: string[]) {
        if (!Array.isArray(texts)) {
            return { error: 'texts phải là một mảng' };
        }
        if (texts.length === 0) {
            return { error: 'texts không được rỗng' };
        }
        return await this.nlpService.buildKnowledgeGraph(texts);
    }

    @Get('find-word')
    async findWord(@Query('word') word: string, @Query('label') label: string) {
        if (!word) {
            return { error: 'Thiếu tham số word' };
        }
        return await this.nlpService.findWord(word, label);
    }

    @Get('find-word-by-label')
    async findWordByLabel(@Query('word') word: string, @Query('toLabel') toLabel: string) {
        if (!word) {
            return { error: 'Thiếu tham số word' };
        }
        return await this.nlpService.findWordByLabel(word, toLabel);
    }

    @Post('clear-invalid-pronouns')
    async clearInvalidPronouns() {
        return await this.nlpService.cleanInvalidPronounNodes();
    }

}