import { Controller, Get, Post, Body, Param, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { PhowhisperService } from '../services/phowhisper.service';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { MessagePattern } from '@nestjs/microservices';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreatePostDto } from '../core/dto/post/createPost.dto';
import { UpdatePostDto, UpdateKeywordsDto } from '../core/dto/post/updatePost.dto';
import { PostService } from '../services/post.service';

@Controller('api/phowhisper')
export class PhowhisperController {
    constructor(private readonly phowhisperService: PhowhisperService) {}
    @Post('get-subtitle')
    @UseInterceptors(FileInterceptor('file'))
    async getSubtitle(
    @UploadedFile() file?: Express.Multer.File,
    @Body('videoUrl') videoUrl?: string,
    ) {
        console.log('Received request with videoUrl:', videoUrl, 'and file:', file ? file.originalname : 'no file');
        return this.phowhisperService.getSubtitle(videoUrl, file);
    }


    @Get('download-subtitle/:requestId/:fileType')
    async downloadSubtitle(
        @Param('requestId') requestId: string,
        @Param('fileType') fileType: 'srt' | 'txt',
    ) {
        return this.phowhisperService.downloadSubtitle(requestId, fileType);
    }

    


}