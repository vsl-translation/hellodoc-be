import { Body, Controller, Get, Inject, NotFoundException, Param, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { NewsService } from '../service/news.service';
import { MessagePattern } from '@nestjs/microservices';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreateNewsDto } from '../core/dto/createNews.dto';
import { InjectModel } from '@nestjs/mongoose';
import { News } from '../core/schema/news.schema';
import { Model } from 'mongoose';
import { UpdateNewsDto } from '../core/dto/updateNews.dto';

@Controller()
export class NewsController {
  constructor(
    @InjectModel(News.name, 'newsConnection') private newsModel: Model<News>,
    private readonly newsService: NewsService
  ) { }

  @MessagePattern('news.get-all')
  async getAllNews() {
    return this.newsService.getAll();
  }

  @MessagePattern('news.create')
  //@UseInterceptors(FilesInterceptor('images'))
  async create(@UploadedFiles() files: Express.Multer.File[], @Body() dto: CreateNewsDto) {
    if (files && files.length > 0) dto.images = files;
    return this.newsService.create(dto);
  }

  @MessagePattern('news.get-by-id')
  async getById(id: string) {
    return this.newsService.getOne(id);
  }

  @MessagePattern('news.update')
  @UseInterceptors(FilesInterceptor('images'))
  async update(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Body() dto: UpdateNewsDto) {
    dto.images = files;
    return this.newsService.update(id, dto);
  }

  @MessagePattern('news.delete')
  async delete(id: string): Promise<{ message: string }> {
    const updated = await this.newsModel.findByIdAndUpdate(id, { isHidden: true }, { new: true });
    if (!updated) throw new NotFoundException('Tin tức không tồn tại');
    return { message: 'Đã ẩn tin tức thành công' };
  }
}
