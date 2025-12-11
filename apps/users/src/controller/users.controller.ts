import { Body, Controller, Get, Post, Put, Delete, Param } from '@nestjs/common';
import { UsersService } from '../service/users.service';
import { UpdateFcmDto } from '../core/dto/update-fcm.dto';
import { CreateUserDto } from '../core/dto/createUser.dto';

@Controller('users') // Thêm prefix route
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Put(':id/fcm-token')
  async updateFcmToken(@Param('id') id: string, @Body() updateFcmDto: UpdateFcmDto) {
    return this.usersService.updateFcmToken(id, updateFcmDto);
  }

  @Get()
  async getUser() {
    return this.usersService.getUser();
  }

  @Get('all')
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get(':id')
  async getUserByID(@Param('id') id: string) {
    return this.usersService.getUserByID(id);
  }

  @Get('soft-deleted')
  async getSoftDeletedUsers() {
    return this.usersService.getSoftDeletedUsers();
  }

  @Post('signup')
  async createUser(@Body() userData: CreateUserDto) {
    return this.usersService.signup(userData);
  }

  @Put('update-password')
  async updatePassword(@Body() body: { email: string, newPassword: string }) {
    return this.usersService.updatePassword(body.email, body.newPassword);
  }

  @Post('notify')
  async notify(@Body() body: { userId: string, message: string }) {
    return this.usersService.notify(body.userId, body.message);
  }

  @Post('apply-for-doctor')
  async applyForDoctor(@Body() data: { userId: string, applyData: any }) {
    const { userId, applyData } = data;
    const doctorData = { ...applyData };
    return this.usersService.applyForDoctor(userId, doctorData);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }

  @Post()
  async create(@Body() data: any) {
    return this.usersService.create(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.usersService.updateUser(id, data);
  }
}