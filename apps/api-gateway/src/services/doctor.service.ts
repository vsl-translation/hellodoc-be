import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { lastValueFrom } from "rxjs";

@Injectable()
export class DoctorService {
    constructor(
        @Inject('DOCTOR_CLIENT') private doctorClient: ClientProxy,

    ) { }
    async getAllDoctor() {
        return this.doctorClient.send('doctor.get-all', {})
    }

    async getAllWithFilter(limit?: string, offset?: string, searchText?: string) {
        return lastValueFrom(this.doctorClient.send('doctor.get-all-filtered', {
            limit: limit ? parseInt(limit) : 10,
            offset: offset ? parseInt(offset) : 0,
            searchText
        }));
    }

    async getDoctorById(id: string) {
        return this.doctorClient.send('doctor.get-by-id', id)
    }

    async applyForDoctor(userId: string, applyData: any) {
        return this.doctorClient.send('doctor.apply-for-doctor', { userId, applyData })
    }

    async getPendingDoctor() {
        return this.doctorClient.send('doctor.get-pedingDoctor', {})
    }

    async getPendingDoctorById(id: string) {
        return this.doctorClient.send('doctor.get-pedingDoctor-by-id', id)
    }

    async getAvailableWorkingTime(id: string) {
        return this.doctorClient.send('doctor.getAvailableWorkingTime', id)
    }

    async updateDoctorProfile(id: string, profileData: any) {
        return this.doctorClient.send('doctor.update', { id, profileData })
    }

    async updateClinicInfo(id: string, clinicData: any) {
        return this.doctorClient.send('doctor.update-clinic-info', { id, clinicData })
    }

    async verifyDoctor(userId: string) {
        return this.doctorClient.send('doctor.verify-doctor', userId)
    }

    async getDoctorHomeVisit(specialtyId: string) {
        return this.doctorClient.send('doctor.get-doctor-home-visit', specialtyId)
    }

}