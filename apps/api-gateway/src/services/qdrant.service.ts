import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";

@Injectable()
export class QdrantService {
    constructor(
        @Inject('QDRANT_CLIENT') private qdrantClient: ClientProxy
    ) { }

    async testSimpleUpsert() {
        return firstValueFrom(
            this.qdrantClient.send('qdrant.test-simple-upsert', {})
        );
    }
}