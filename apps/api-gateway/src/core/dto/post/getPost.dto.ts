// get-posts.dto.ts
import { IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetPostsDto {
  @IsOptional()
  @Type(() => Number) // <--- Cực kỳ quan trọng: Tự động convert String -> Number
  @IsNumber()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number) // <--- Tự động convert String -> Number
  @IsNumber()
  @Min(0)
  skip?: number;
}