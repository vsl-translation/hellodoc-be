import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { DoctorService } from '../service/doctor.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@Controller('doctor')
export class DoctorController {
  constructor(
    private readonly doctorService: DoctorService
  ) { }

  @Get('get-by-id/:id')
  async getDoctorById(@Param('id') id: string) {
    return this.doctorService.getDoctorById(id);
  }

  @Get()
  async getAllDoctor() {
    return this.doctorService.getAllDoctor();
  }

  // @MessagePattern('doctor.get-by-specialtyID')
  // async getDoctorBySpecialtyID(specialtyID: string) {
  //   return this.doctorService.getDoctorBySpecialtyID(specialtyID);
  // }

  // @MessagePattern('doctor.update-fcm-token')
  // async updateFcmToken(id: string, token: string) {
  //   return this.doctorService.updateFcmToken(id, token);
  // }

  @Put('updatePassword')
  async updatePassword(@Body() email: string, newPassword: string) {
    return this.doctorService.updatePassword(email, newPassword);
  }

  @Post('notify')
  async notify(doctorId: string, message: string) {
    return this.doctorService.notify(doctorId, message);
  }

  @Get('get-pedingDoctor')
  async getPendingDoctor() {
    return this.doctorService.getPendingDoctors();
  }

  @Get('get-pedingDoctor-by-id/:id')
  async getPendingDoctorById(@Param('id') id: string) {
    return this.doctorService.getPendingDoctorById(id);
  }

  @Post('create-pending-doctor')
  async createPendingDoctor(@Body() data: any) {
    return this.doctorService.createPendingDoctor(data);
  }

  @Patch('apply-for-doctor')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'licenseUrl', maxCount: 1 },
      { name: 'faceUrl', maxCount: 1 },
      { name: 'avatarURL', maxCount: 1 },
      { name: 'frontCccdUrl', maxCount: 1 },
      { name: 'backCccdUrl', maxCount: 1 },
    ])
  )
  async applyForDoctor(@Body() payload: { userId: string, applyData: any }) {
    const { userId, applyData } = payload;
    return this.doctorService.applyForDoctor(userId, applyData);
  }

  @Delete('delete')
  async delete(id: string) {
    return this.doctorService.delete(id);
  }

  // @Post('doctor.create')
  // async create(@Payload() data: any) {
  //   return this.doctorService.create(data);
  // }

  @Put('update/:id')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'license', maxCount: 1 },
      { name: 'image', maxCount: 1 },
      { name: 'frontCccd', maxCount: 1 },
      { name: 'backCccd', maxCount: 1 },
    ])
  )
  async update(@Param('id') id: string, @Body() data: any) {
    return this.doctorService.updateDoctor(id, data);
  }

  @Get('getAvailableWorkingTime/:id')
  async getAvailableWorkingTime(@Param('id') doctorID: string) {
    return await this.doctorService.getAvailableWorkingHours(doctorID);
  }
}