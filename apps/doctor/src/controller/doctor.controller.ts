import { Controller, Get } from '@nestjs/common';
import { DoctorService } from '../service/doctor.service';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) { }

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
}
