import { Controller, Get } from '@nestjs/common';
import { ApiGatewayService } from '../services/api-gateway.service';

@Controller()
export class ApiGatewayController {
  constructor(private readonly apiGatewayService: ApiGatewayService) { }

  @Get()
  getHello(): string {
    return this.apiGatewayService.getHello();
  }
}
