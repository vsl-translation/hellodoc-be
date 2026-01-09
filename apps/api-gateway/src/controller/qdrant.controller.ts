import { Controller, Get } from "@nestjs/common";
import { QdrantService } from "../services/qdrant.service";

@Controller('qdrant')
export class QdrantController {
    constructor(private readonly qdrantService: QdrantService) { }
    @Get('test-simple-upsert')
    async testSimpleUpsert() {
        return this.qdrantService.testSimpleUpsert();
    }

}