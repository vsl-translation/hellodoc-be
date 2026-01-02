import { HttpService } from "@nestjs/axios";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClientProxy } from "@nestjs/microservices";
import { firstValueFrom, lastValueFrom } from "rxjs";

@Injectable()
export class DoctorService {
    private readonly doctorBaseUrl: string;
    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        //@Inject('DOCTOR_CLIENT') private doctorClient: ClientProxy,

    ) {
        this.doctorBaseUrl = this.configService.get<string>('DOCTOR_SERVICE_URL') || 'http://localhost:3003';

    }
    async getAllDoctor() {
        const response = await firstValueFrom(
            this.httpService.get(`${this.doctorBaseUrl}/doctor/get-all`)
        );
        return response.data;
    }

    // async getAllWithFilter(limit?: string, offset?: string, searchText?: string) {
    //     return lastValueFrom(this.doctorClient.send('doctor.get-all-filtered', {
    //         limit: limit ? parseInt(limit) : 10,
    //         offset: offset ? parseInt(offset) : 0,
    //         searchText
    //     }));
    // }

    async getDoctorById(id: string) {
        const response = await firstValueFrom(
            this.httpService.get(`${this.doctorBaseUrl}/doctor/get-by-id/${id}`)
        );
        return response.data;
    }

    // async applyForDoctor(userId: string, applyData: any) {
    //     return this.doctorClient.send('doctor.apply-for-doctor', { userId, applyData })
    // }

    // async getPendingDoctor() {
    //     return this.doctorClient.send('doctor.get-pedingDoctor', {})
    // }

    // async getPendingDoctorById(id: string) {
    //     return this.doctorClient.send('doctor.get-pedingDoctor-by-id', id)
    // }

    // async getRejectedDoctors() {
    //     return this.doctorClient.send('doctor.get-rejected-doctor', {})
    // }

    // async getAvailableWorkingTime(id: string) {
    //     return this.doctorClient.send('doctor.getAvailableWorkingTime', id)
    // }

    // async updateDoctorProfile(id: string, profileData: any) {
    //     return this.doctorClient.send('doctor.update', { id, profileData })
    // }

    // async updateClinicInfo(id: string, clinicData: any) {
    //     return this.doctorClient.send('doctor.update-clinic-info', { id, clinicData })
    // }

    // async verifyDoctor(userId: string) {
    //     return this.doctorClient.send('doctor.verify-doctor', userId)
    // }

    // async rejectDoctor(userId: string, reason: string) {
    //     return this.doctorClient.send('doctor.reject-doctor', { userId, reason })
    // }

    // async getDoctorHomeVisit(specialtyId: string) {
    //     return this.doctorClient.send('doctor.get-doctor-home-visit', specialtyId)
    // }

}