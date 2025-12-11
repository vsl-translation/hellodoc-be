import { HttpService } from "@nestjs/axios";
import { Inject, Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AxiosError } from "axios";
import { firstValueFrom } from "rxjs";

@Injectable()
export class DoctorService {
    private readonly baseUrl: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.baseUrl = this.configService.get('DOCTORS_SERVICE_URL') || 'http://localhost:3003';
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

    async getAllDoctor() {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/doctor`)
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

    async getDoctorById(id: string) {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/doctor/get-by-id/${id}`)
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

    async applyForDoctor(userId: string, applyData: any) {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/doctor/apply-for-doctor`, {
                    userId,
                    applyData
                })
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

    async getPendingDoctor() {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/doctor/get-pedingDoctor`)
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

    async getPendingDoctorById(id: string) {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/doctor/get-pedingDoctor-by-id/${id}`)
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

    async getAvailableWorkingTime(id: string) {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/doctor/getAvailableWorkingTime/${id}`)
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

    async updateDoctorProfile(id: string, profileData: any) {
        try {
            const response = await firstValueFrom(
                this.httpService.put(`${this.baseUrl}/doctor/update/${id}`, profileData)
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

}