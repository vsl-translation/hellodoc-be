import { IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class UpdateNotificationDto {
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @IsDateString()
  readAt?: Date;

  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;
}

