import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { MediaUrlHelper } from 'libs/media-url.helper';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { News } from '../core/schema/news.schema';
import { CreateNewsDto } from '../core/dto/createNews.dto';
import { UpdateNewsDto } from '../core/dto/updateNews.dto';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class NewsService {
  constructor(
    @InjectModel(News.name, 'newsConnection') private newsModel: Model<News>,
    @Inject('MEDIA_CLIENT') private mediaClient: ClientProxy,
    private readonly mediaUrlHelper: MediaUrlHelper,
) { }

  async getAll(): Promise<News[]> {
    const news = await this.newsModel.find({ isHidden: false }).sort({ createdAt: -1 }).exec();
    return this.mediaUrlHelper.constructArrayUrls(news, ['media']);
  }

  async getAllWithFilter(limit: number, skip: number, searchText?: string) {
    let filter: any = { isHidden: false };
    if (searchText && searchText.trim() !== '') {
      filter.$or = [
        { title: { $regex: searchText, $options: 'i' } },
        { content: { $regex: searchText, $options: 'i' } },
      ];
    }

    const total = await this.newsModel.countDocuments(filter);

    const news = await this.newsModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const newsWithUrls = this.mediaUrlHelper.constructArrayUrls(news, ['media']);

    return { data: newsWithUrls, total };
  }

  async getOne(id: string): Promise<News> {
    const news = await this.newsModel.findById(id).exec();
    if (!news) throw new NotFoundException('Không tìm thấy tin tức');
    return this.mediaUrlHelper.constructObjectUrls(news.toObject(), ['media']);
  }
  async update(id: string, updateDto: UpdateNewsDto): Promise<News> {
    console.log('updateDto', updateDto);

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid ID format');
    }

    const Id = new Types.ObjectId(id);

    const news = await this.newsModel.findById(Id);
    if (!news) throw new NotFoundException('Tin tức không tồn tại');

    const uploadedMediaUrls: string[] = [];

    if (updateDto.images && updateDto.images.length > 0) {
      for (const imageData of updateDto.images) {
        try {
          console.log(`Uploading image: ${imageData.originalname}`);

          // Gửi Base64 string tới Media service
          const uploadResult = await this.mediaClient
            .send('media.upload', {
              buffer: imageData.buffer, // Base64 string
              filename: imageData.originalname,
              mimetype: imageData.mimetype,
              folder: `news/${id}/thumbnail`,
            })
            .toPromise();

          console.log(`Upload success: ${uploadResult.relative_path}`);
          if (!news.media) news.media = [];
          news.media.push(uploadResult.relative_path);
        } catch (error) {
          console.error(
            `Error uploading image ${imageData.originalname}:`,
            error.message,
          );
          throw new InternalServerErrorException(
            `Failed to upload image ${imageData.originalname}: ${error.message}`,
          );
        }
      }

      // Nếu có ảnh upload, cập nhật media
      // media updated directly in the loop
    }
    // Giữ media cũ nếu FE gửi lại
    else if (updateDto.media && updateDto.media.length > 0) {
      news.media = updateDto.media;
    }

    if (updateDto.title) news.title = updateDto.title;
    if (updateDto.content) news.content = updateDto.content;

    // Lưu document
    const savedNews = await news.save();
    return this.mediaUrlHelper.constructObjectUrls(savedNews.toObject(), ['media']);
  }


  async delete(id: string): Promise<{ message: string }> {
    const updated = await this.newsModel.findByIdAndUpdate(id, { isHidden: true }, { new: true });
    if (!updated) throw new NotFoundException('Tin tức không tồn tại');
    return { message: 'Đã ẩn tin tức thành công' };
  }
}
