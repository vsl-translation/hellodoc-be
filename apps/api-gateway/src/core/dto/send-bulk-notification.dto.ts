import { IsNotEmpty, IsArray, IsString, IsIn, ArrayMinSize } from 'class-validator';

export class SendBulkNotificationDto {
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  userIds: string[];

  @IsString()
  @IsNotEmpty()
  @IsIn(['User', 'Doctor'])
  userModel: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['ForPost', 'ForAppointment'])
  type: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  navigatePath: string;
}

