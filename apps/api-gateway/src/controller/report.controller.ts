import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ReportService } from '../services/report.service';
import { CreateReportDto } from '../core/dto/report/create-report.dto';
import { UpdateReportStatusDto, UpdateReportResponseDto } from '../core/dto/report/update-report.dto';

@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) { }

  @Post()
  async create(@Body() createReportDto: CreateReportDto) {
    return this.reportService.create(createReportDto);
  }

  @Get()
  async getAll() {
    return this.reportService.getAll();
  }

  @Get('user/:userId')
  async getByUserId(@Param('userId') userId: string) {
    return this.reportService.getByUserId(userId);
  }

  @Get('get-all-filtered')
  async getAllWithFilter(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('searchText') searchText?: string,
  ) {
    return this.reportService.getAllWithFilter(limit, offset, searchText);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateReportStatusDto,
  ) {
    return this.reportService.updateStatus(id, updateStatusDto.status);
  }

  @Patch(':id/response')
  async updateResponse(
    @Param('id') id: string,
    @Body() updateResponseDto: UpdateReportResponseDto,
  ) {
    return this.reportService.updateResponse(
      id,
      updateResponseDto.responseContent,
      updateResponseDto.responseTime,
    );
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.reportService.delete(id);
  }
}
