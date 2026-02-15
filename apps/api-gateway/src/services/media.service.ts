import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";

@Injectable()
export class MediaService {
    constructor(
        @Inject('MEDIA_CLIENT') private mediaClient: ClientProxy,

    ) { }

    async uploadFile(file: Express.Multer.File) {
        return this.mediaClient.send('media.upload', file)
    }

}