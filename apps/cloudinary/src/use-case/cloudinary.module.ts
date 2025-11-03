import { Module } from '@nestjs/common';
import { CloudinaryController } from '../controller/cloudinary.controller';
import { CloudinaryService } from '../service/cloudinary.service';
import { CloudinaryProvider } from '../provider/cloudinary.provider';

@Module({
  imports: [],
  controllers: [CloudinaryController],
  providers: [CloudinaryService, CloudinaryProvider],
  exports: [CloudinaryService, CloudinaryProvider],
})
export class CloudinaryModule { }
