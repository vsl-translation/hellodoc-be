import { IsString, IsUrl, IsOptional } from 'class-validator';

export class CreateVideoDto {
    @IsString()
    title: string;

    @IsUrl()
    videoUrl: string;

    @IsOptional()
    @IsString()
    description?: string;
}