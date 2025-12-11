import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class UsersService {
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get('USERS_SERVICE_URL') || 'http://localhost:3001';
  }

  async findAll() {
    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/users`)
    );
    return response.data;
  }

  async getAllUsers() {
    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/users/all`)
    );
    return response.data;
  }

  async getUserById(id: string) {
    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/users/${id}`)
    );
    return response.data;
  }

  async updateUser(id: string, data: any) {
    const response = await firstValueFrom(
      this.httpService.put(`${this.baseUrl}/users/${id}`, data)
    );
    return response.data;
  }
}