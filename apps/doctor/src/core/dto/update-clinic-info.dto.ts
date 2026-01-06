
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class WorkingHourDto {
  @IsNumber()
  dayOfWeek: number;

  @IsNumber()
  hour: number;

  @IsNumber()
  minute: number;
}

export class ServiceInputDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  maxprice?: number;

  @IsOptional()
  @IsNumber()
  minprice?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageService?: string[];

  @IsOptional()
  @IsString()
  specialtyId?: string;

  @IsOptional()
  @IsString()
  specialtyName?: string;
}

export class UpdateClinicInfoDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceInputDto)
  services?: ServiceInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceInputDto)
  oldService?: ServiceInputDto[];

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHourDto)
  workingHours?: WorkingHourDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHourDto)
  oldWorkingHours?: WorkingHourDto[];

  @IsOptional()
  hasHomeService?: boolean;

  @IsOptional()
  isClinicPaused?: boolean;
}
