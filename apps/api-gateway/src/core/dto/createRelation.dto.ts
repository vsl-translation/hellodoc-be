import { IsString } from 'class-validator';

export class CreateRelationDto {
  @IsString()
  fromLabel: string;

  @IsString()
  fromName: string;

  @IsString()
  toLabel: string;

  @IsString()
  toName: string;

  @IsString()
  relationType: string;
}
