import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { UpdateUserDto } from '../core/dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(@Inject('USERS_CLIENT') private usersClient: ClientProxy) { }

  findAll() {
    return this.usersClient.send('user.users', {});
  }

  getAllUsers() {
    return this.usersClient.send('user.getallusers', {});
  }

  async getAllWithFilter(limit?: string, offset?: string, searchText?: string) {
    return lastValueFrom(this.usersClient.send('user.get-all-filtered', {
      limit: limit ? parseInt(limit) : 10,
      offset: offset ? parseInt(offset) : 0,
      searchText
    }));
  }

  getUserById(id: string) {
    return this.usersClient.send('user.getuserbyid', id);
  }

  updateUser(id: string, data: UpdateUserDto) {
    return this.usersClient.send('user.update', { id, data });
  }

  updateFcmToken(id: string, updateFcmDto: any) {
    return this.usersClient.send('user.updateFcmToken', { id, token: updateFcmDto.token, userModel: updateFcmDto.userModel });
  }
}
