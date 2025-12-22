import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { Payload } from '@nestjs/microservices';

@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  //trong microservices sử dụng message và event
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get('getallusers')
  getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get('get-all-filtered')
  getAllWithFilter(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('searchText') searchText?: string,
  ) {
    return this.usersService.getAllWithFilter(limit, offset, searchText);
  }

  @Get('getuserbyid/:id')
  getUserByID(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  @Put('updateUser/:id')
  updateUser(@Param('id') id: string, @Body() data: any) {
    return this.usersService.updateUser(id, data);
  }

  @Put(':id/fcm-token')
  updateFcmToken(@Param('id') id: string, @Body() updateFcmDto: any) {
    return this.usersService.updateFcmToken(id, updateFcmDto);
  }

}
