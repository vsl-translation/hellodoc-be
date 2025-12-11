import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AdminService {
    private readonly baseUrl: string;
    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.baseUrl = this.configService.get('ADMIN_SERVICE_URL') || 'http://localhost:3010';
    }
    // Helper method để xử lý lỗi HTTP
    private handleHttpError(error: AxiosError) {
        if (error.response) {
            throw new InternalServerErrorException(
                error.response.data || 'Service error',
            );
        }
        throw new InternalServerErrorException('Service unavailable');
    }


    async getUsers() {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/admin/users`)
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

    async updateUser(id: string, data: any) {
        try {
            const response = await firstValueFrom(
                this.httpService.put(`${this.baseUrl}/admin/users/${id}`, data)
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

    async getDoctors() {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/admin/doctors`)
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

    async deleteUser(id: string) {
        try {
            const response = await firstValueFrom(
                this.httpService.delete(`${this.baseUrl}/admin/users/${id}`)
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

    async deleteDoctor(id: string) {
        try {
            const response = await firstValueFrom(
                this.httpService.delete(`${this.baseUrl}/admin/doctors/${id}`)
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

}