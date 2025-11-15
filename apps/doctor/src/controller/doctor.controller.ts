import { Body, Controller, Get, Param, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { DoctorService } from '../service/doctor.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@Controller()
export class DoctorController {
  constructor(
    private readonly doctorService: DoctorService
  ) { }

  @MessagePattern('doctor.get-by-id')
  async getDoctorById(id: string) {
    return this.doctorService.getDoctorById(id);
  }

  @MessagePattern('doctor.get-all')
  async getAllDoctor() {
    return this.doctorService.getAllDoctor();
  }

  @MessagePattern('doctor.update-fcm-token')
  async updateFcmToken(id: string, token: string) {
    return this.doctorService.updateFcmToken(id, token);
  }

  @MessagePattern('doctor.updatePassword')
  async updatePassword(@Body() email: string, newPassword: string) {
    return this.doctorService.updatePassword(email, newPassword);
  }

  @MessagePattern('doctor.notify')
  async notify(doctorId: string, message: string) {
    return this.doctorService.notify(doctorId, message);
  }

  @MessagePattern('doctor.get-pedingDoctor')
  async getPendingDoctor() {
    return this.doctorService.getPendingDoctors();
  }

  @MessagePattern('doctor.get-pedingDoctor-by-id')
  async getPendingDoctorById(id: string) {
    return this.doctorService.getPendingDoctorById(id);
  }

  @MessagePattern('doctor.create-pending-doctor')
  async createPendingDoctor(@Payload() data: any) {
    return this.doctorService.createPendingDoctor(data);
  }


  @MessagePattern('doctor.apply-for-doctor')
  async applyForDoctor(@Payload() payload: { userId: string, applyData: any }) {
    const { userId, applyData } = payload;
    return this.doctorService.applyForDoctor(userId, applyData);
  }
}