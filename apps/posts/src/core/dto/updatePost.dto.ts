import { IsOptional, IsMongoId, IsNotEmpty, IsString } from 'class-validator';
import { Express } from 'express';

export class UpdatePostDto {
    @IsNotEmpty()
    @IsMongoId()
    userId: string;

    @IsOptional()
    content?: string;

    @IsOptional()
    media?: string[]; // Mảng URL ảnh cũ

    @IsOptional()
    images?: Express.Multer.File[]; // Đây là phần cần được xác định rõ

    @IsOptional()
    keywords?: string;

}

export class UpdateKeywordsDto {
    @IsString()
    keywords: string;
}