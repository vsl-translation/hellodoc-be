import { Body, Controller, Delete, Get, Param, Patch, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { NewsService } from '../services/news.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UpdateNewsDto } from 'apps/news/src/core/dto/updateNews.dto';
import { CreateNewsDto } from 'apps/news/src/core/dto/createNews.dto';

@Controller('news')
export class NewsController {
    constructor(private readonly newsService: NewsService) { }

    //trong microservices sử dụng message và event
    @Get('get-all')
    getAllNews() {
        return this.newsService.getAll();
    }

    @Get(':id')
    getAllUsers(@Param('id') id: string) {
        return this.newsService.getById(id);
    }

    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.newsService.delete(id);
    }

    @Patch(':id')
    @UseInterceptors(FilesInterceptor('images'))
    async update(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Body() dto: UpdateNewsDto) {
        dto.images = files;
        return this.newsService.update(id, dto);
    }

    @Post('create')
    @UseInterceptors(FilesInterceptor('images'))
    async create(@UploadedFiles() files: Express.Multer.File[], @Body() dto: CreateNewsDto) {
        if (files && files.length > 0) dto.images = files;
        return this.newsService.create(dto);
    }
}
