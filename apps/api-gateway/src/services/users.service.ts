import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, lastValueFrom } from 'rxjs';

@Injectable()
export class UsersService {
  private baseUrl = this.configService.get('USERS_SERVICE_URL') || 'http://localhost:3001';
  constructor(
    //@Inject('USERS_CLIENT') private usersClient: ClientProxy,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get('USERS_SERVICE_URL') || 'http://localhost:3001';
  }

  async findAll() {
    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/user`)
    );
    return response.data;
  }

  async getAllUsers() {
    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/user/getallusers`)
    );
    return response.data;
  }

  // async getAllWithFilter(limit?: string, offset?: string, searchText?: string) {
  //   return lastValueFrom(this.usersClient.send('user.get-all-filtered', {
  //     limit: limit ? parseInt(limit) : 10,
  //     offset: offset ? parseInt(offset) : 0,
  //     searchText
  //   }));
  // }

  // getUserById(id: string) {
  //   return this.usersClient.send('user.getuserbyid', id);
  // }

  // updateUser(id: string, data: any) {
  //   return this.usersClient.send('user.update', { id, data });
  // }

  // updateFcmToken(id: string, updateFcmDto: any) {
  //   return this.usersClient.send('user.updateFcmToken', { id, token: updateFcmDto.token, userModel: updateFcmDto.userModel });
  // }
}
