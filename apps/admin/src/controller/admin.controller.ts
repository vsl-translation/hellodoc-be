import {
    Body,
    Controller,
    Param,
    Get,
    Post,
    Put,
    UseGuards,
    Patch,
    Delete,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FileInterceptor } from '@nestjs/platform-express';
import { Types } from 'mongoose';
import { Express } from 'express';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AdminService } from '../service/admin.service';
import { SignupDto } from '../core/dto/signup.dto';
import { JwtHybridAuthGuard } from 'libs/Guard/jwt-auth.guard';
import { AdminGuard } from 'libs/Guard/AdminGuard.guard';

@Controller('admin')
export class AdminController {
    constructor(
        private readonly adminService: AdminService,
    ) { }

    @Post()
    async createAdmin(@Body() signUpData: SignupDto) {
        return this.adminService.postAdmin(signUpData);
    }

    @Get('users')
    async getUsers() {
        return this.adminService.getUsers();
    }

    @Get('doctors')
    async getDoctors() {
        return this.adminService.getDoctors();
    }

    @Get('admins')
    async getAllUsers() {
        return this.adminService.getAdmins();
    }

    @Put('users/:id')
    async updateUser(@Param('id') id: string, @Body() data: any) {
        return this.adminService.updateUser(id, data);
    }

    @Delete('users/:id')
    async deleteUser(@Param('id') id: string) {
        return this.adminService.deleteUser(id);
    }


    @Delete('doctors/:id')
    async deleteDoctor(@Param('id') id: string) {
        return this.adminService.deleteDoctor(id);
    }

    @Post('createAdmin')
    async postAdmin(@Body() signUpData: SignupDto) {
        return this.adminService.postAdmin(signUpData);
    }


}
