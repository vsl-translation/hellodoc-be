import { Controller, Get, Param } from '@nestjs/common';
import { DoctorService } from '../services/doctor.service';

@Controller('doctor')
export class DoctorController {
    constructor(private readonly doctorService: DoctorService) { }

    //trong microservices sử dụng message và event
    @Get('get-all')
    findAll() {
        return this.doctorService.getAllDoctor();
    }

    @Get('get-by-id/:id')
    getDoctorById(@Param('id') id: string) {
        return this.doctorService.getDoctorById(id);
    }


}
