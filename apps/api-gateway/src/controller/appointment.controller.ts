import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { BookAppointmentDto } from "../core/dto/appointment.dto";
import { AppointmentService } from "../services/appointment.service";

@Controller('appointments')
export class AppointmentController {
    constructor(private readonly appointmentService: AppointmentService) { }

    @Post('book')
    async bookAppoinentment(@Body() bookData: BookAppointmentDto) {
        return await this.appointmentService.bookAppointment(bookData);
    }

    @Get('getAll')
    async getAllAppointments() {
        return await this.appointmentService.getAllAppointments();
    }

    @Get('doctor/:doctorID')
    async getDoctorAppointments(@Param('doctorID') doctorID: string) {
        return await this.appointmentService.getDoctorAppointments(doctorID);
    }

    @Get('patient/:patientID')
    async getPatientAppointments(@Param('patientID') patientID: string) {
        return await this.appointmentService.getPatientAppointments(patientID);
    }

    @Get('doctor/:doctorID/stats')
    async getDoctorStats(@Param('doctorID') doctorID: string) {
        return await this.appointmentService.getDoctorStats(doctorID);
    }

    @Patch('cancel/:id')
    async cancelAppoinentment(@Param('id') id: string) {
        return await this.appointmentService.cancelAppointment(id);
    }

    @Delete('/:id')
    async deleteAppointment(@Param('id') id: string) {
        return await this.appointmentService.deleteAppointment(id);
    }

    @Put('/:id')
    async updateAppointment(@Param('id') id: string, @Body() updateData: Partial<BookAppointmentDto>) {
        return await this.appointmentService.updateAppointment(id, updateData);
    }

    @Patch('confirm/:id')
    async confirmAppoinentment(@Param('id') id: string) {
        return await this.appointmentService.confirmAppointmentDone(id);
    }

}