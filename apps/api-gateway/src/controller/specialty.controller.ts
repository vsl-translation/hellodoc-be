import { Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateSpecialtyDto } from '../core/dto/update-specialty.dto';
import { CreateSpecialtyDto } from '../core/dto/create-specialty.dto';
import { SpecialtyService } from '../services/specialty.service';
import { GetSpecialtyByNameDto } from '../core/dto/specialty/get-specialty-by-name.dto';

@Controller('specialty')
export class SpecialtyController {
    constructor(private readonly specialtyService: SpecialtyService) { }

    @Get('get-all')
    getSpecialties() {
        return this.specialtyService.getSpecialties();
    }

    @Get('get-all-filtered')
    getSpecialtiesFiltered(
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
        @Query('searchText') searchText?: string,
    ) {
        return this.specialtyService.getAllWithFilter(limit, offset, searchText);
    }

    @Post('create')
    @UseInterceptors(FileInterceptor('icon')) // 'icon' là tên field form-data
    async createSpecialty(
        @UploadedFile() file: Express.Multer.File,
        @Body() createSpecialtyDto: CreateSpecialtyDto,
    ) {
        if (file) {
            createSpecialtyDto.image = file;
        }

        return this.specialtyService.create(createSpecialtyDto);
    }

    @Put(':id')
    @UseInterceptors(FileInterceptor('icon'))
    async updateSpecialty(
        @Param('id') id: string,
        @UploadedFile() file: Express.Multer.File,
        @Body() updateSpecialtyDto: UpdateSpecialtyDto,
    ) {
        if (file) {
            updateSpecialtyDto.image = file;
        }

        return this.specialtyService.update(id, updateSpecialtyDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.specialtyService.remove(id);
    }

    @Get('doctors/:id')
    getSpecialtyById(@Param('id') id: string) {
        return this.specialtyService.getSpecialtyById(id);
    }

    @Post('specialty-by-name')
    getSpecialtyByName(@Body() dto: GetSpecialtyByNameDto) {
        return this.specialtyService.getSpecialtyByName(dto.name);
    }
}
