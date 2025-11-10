import { Body, Controller, Get, UseGuards } from '@nestjs/common';
import { AppointmentService } from '../service/appointment.service';
import { JwtAuthGuard } from 'libs/Guard/jwt-auth.guard';
import { MessagePattern } from '@nestjs/microservices';
import { BookAppointmentDto } from '../core/dto/appointment.dto';

@Controller()
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) { }

  //@UseGuards(JwtAuthGuard)
  @MessagePattern('appointment.book')
  async bookAppoinentment(@Body() bookData: BookAppointmentDto) {
    return await this.appointmentService.bookAppointment(bookData);
  }

  @MessagePattern('appointment.getAll')
  async getAllAppointments() {
    return await this.appointmentService.getAllAppointments();
  }
}
