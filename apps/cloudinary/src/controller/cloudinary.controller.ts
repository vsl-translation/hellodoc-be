import { Controller, Get } from '@nestjs/common';
import { CloudinaryService } from '../service/cloudinary.service';

@Controller()
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) { }

  @Get()
  getHello(): string {
    return this.cloudinaryService.getHello();
  }
}
