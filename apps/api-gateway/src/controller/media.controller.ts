import { Body, Controller, Get, Param, Patch, Put, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from '../services/media.service';

@Controller('media')
export class MediaController {
    constructor(private readonly mediaService: MediaService) { }

    @Put('upload')
    @UseInterceptors(FileInterceptor('file'))
    uploadImage(@UploadedFile() file: Express.Multer.File) {
        return this.mediaService.uploadFile(file);
    }
}
