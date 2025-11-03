import { IsNotEmpty, IsString } from "class-validator";

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  id: number;

  @IsString()
  @IsNotEmpty()
  project_name: string;

  @IsString()
  @IsNotEmpty()
  project_description: string;

  @IsString()
  @IsNotEmpty()
  project_type: string;

  project_startDate: Date;
  project_endDate: Date;
  project_numOfDev: number;
  project_media: string;
  project_demo_link: string;
  customer_id: string;
}
