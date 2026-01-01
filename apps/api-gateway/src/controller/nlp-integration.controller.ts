import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { NlpIntegrationService } from '../services/nlp-integration.service';

@Controller('nlp')
export class NlpController {
    constructor(private readonly nlpService: NlpIntegrationService) { }
    @Post('analyze-semantic')
    async analyzeSemanticText(@Body('text') text: string) {
        console.log('Received text for semantic analysis:', text);
        if (!text) {
            return { error: 'Thiếu tham số text' };
        }
        return await this.nlpService.analyzeAndCreateSemanticGraph(text);
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

    // // Phân tích văn bản và tạo graph đơn giản
    // @Post('analyze')
    // async analyzeText(
    //     @Body('text') text: string,
    //     @Body('createRelations') createRelations?: boolean,
    // ) {
    //     if (!text) {
    //         return { error: 'Thiếu tham số text' };
    //     }
    //     return await this.nlpService.analyzeAndCreateGraph(text, createRelations ?? true);
    // }

    /**
     * Phân tích văn bản và tạo semantic graph (có quan hệ ngữ nghĩa)
     * 
     * Ví dụ: "Sinh viên học bài tập khó"
     * Sẽ tạo các quan hệ như:
     * - Sinh viên (N) --SUBJECT_OF--> học (V)
     * - học (V) --HAS_OBJECT--> bài tập (N)
     * - khó (A) --MODIFIES--> bài tập (N)
     */

    // 3. Thêm endpoint vào controller
    @Post('batch-process')
    async batchProcess(@Query('folder') folder?: string) {
        const folderPath = folder || 'data_test/test/pos';
        return await this.nlpService.processBatchFiles(folderPath);
    }

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

}