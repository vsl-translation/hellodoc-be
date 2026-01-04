import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";

@Injectable()
export class NlpIntegrationService {
    constructor(
        @Inject('NLP_CLIENT') private readonly nlpClient: ClientProxy,
    ) { }

    async analyzeAndCreateGraph(text: string, createRelations: boolean = true) {
        return firstValueFrom(
            this.nlpClient.send('nlp-integration.analyze', { text, createRelations })
        );
    }

    async analyzeAndCreateSemanticGraph(text: string) {
        return firstValueFrom(
            this.nlpClient.send('nlp-integration.analyze-semantic', text)
        );
    }

    async buildKnowledgeGraph(texts: string[]) {
        return firstValueFrom(
            this.nlpClient.send('nlp-integration.build-knowledge-graph', texts)
        );
    }


    async findWord(word: string, context: string = '', topK: number = 10) {
        return firstValueFrom(
            this.nlpClient.send('nlp-integration.find-word', {
                word,
                context,
                topK
            })
        );
    }

    async findWordByLabel(
        word: string,
        toLabel: string,
        context: string = '',
        topK: number = 10
    ) {
        return firstValueFrom(
            this.nlpClient.send('nlp-integration.find-word-by-label', {
                word,
                toLabel,
                context,
                topK
            })
        );
    }

    async suggestNextWord(
        word: string,
        currentPosTag: string,
        context: string = '',
        targetPosTag?: string,
        topK: number = 10,
    ) {
        return firstValueFrom(
            this.nlpClient.send('nlp-integration.suggest-next-word', {
                word,
                currentPosTag,
                context,
                targetPosTag,
                topK,
            })
        );
    }

    async processBatchFiles(folderPath: string) {
        return firstValueFrom(
            this.nlpClient.send('nlp-integration.batch-process', folderPath)
        );
    }

    async cleanInvalidPronounNodes() {
        return firstValueFrom(
            this.nlpClient.send('nlp-integration.clearInvalidPronouns', {})
        );
    }


}