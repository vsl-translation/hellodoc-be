import { Body, Controller, Get, Param, Post, Put, Delete, Query, Patch } from '@nestjs/common';
import { UsersService } from '../service/users.service';

@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  // @Put(':id/fcm-token')
  // async updateFcmToken(@Param('id') id: string, @Body() data: any) {
  //   return this.usersService.updateFcmToken(id, data);
  // }

  @Get()
  async getUser() {
    return this.usersService.getUser();
  }

  @Get('getallusers')
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get('get-all-filtered')
  async getAllWithFilter(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('searchText') searchText?: string
  ) {
    const limitNum = limit ? parseInt(limit) : 10;
    const skip = offset ? parseInt(offset) : 0;
    return this.usersService.getAllWithFilter(limitNum, skip, searchText);
  }

  @Get('getuserbyid/:id')
  async getUserByID(@Param('id') id: string) {
    return this.usersService.getUserByID(id);
  }

  @Get('get-soft-deleted-users')
  async getSoftDeletedUsers() {
    return this.usersService.getSoftDeletedUsers();
  }

  @Post('signup')
  async createUser(@Body() userData: any) {
    return this.usersService.signup(userData);
  }

  // @Patch('updatePassword')
  // async updatePassword(@Body() data: { email: string, password: string }) {
  //   return this.usersService.updatePassword(data.email, data.password);
  // }

  // @Post('notify')
  // async notify(@Body() data: { userID: string, message: string }) {
  //   return this.usersService.notify(data.userID, data.message);
  // }

  // @Post('apply-for-doctor/:id')
  // async applyForDoctor(@Param('id') userId: string, @Body() applyData: any) {
  //   return this.usersService.applyForDoctor(userId, applyData);
  // }

  // @Delete(':id')
  // async delete(@Param('id') id: string) {
  //   return this.usersService.delete(id);
  // }

  // @Patch('reactivate-user-account/:id')
  // async reactivateUser(@Param('id') id: string) {
  //   return this.usersService.reactivateUser(id);
  // }

  @Post('create')
  async create(@Body() data: any) {
    return this.usersService.create(data);
  }

  // @Put('update/:id')
  // async update(@Param('id') id: string, @Body() data: any) {
  //   return this.usersService.updateUser(id, data);
  // }

  @Delete('hard-delete/:id')
  async hardDelete(@Param('id') id: string) {
    return this.usersService.hardDelete(id);
  }
}
