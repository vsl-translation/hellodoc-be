import { Body, Controller, Get, Param, Patch, Post, Put, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { DoctorService } from '../services/doctor.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtHybridAuthGuard } from 'libs/Guard/jwt-auth.guard';
import { AdminGuard } from 'libs/Guard/AdminGuard.guard';

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

    // Trong controller, truyền file data một cách rõ ràng:
    @Patch('apply-for-doctor/:id')
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'licenseUrl', maxCount: 1 },
            { name: 'faceUrl', maxCount: 1 },
            { name: 'avatarURL', maxCount: 1 },
            { name: 'frontCccdUrl', maxCount: 1 },
            { name: 'backCccdUrl', maxCount: 1 },
        ])
    )
    applyForDoctor(
        @Param('id') userId: string,
        @UploadedFiles() files: {
            licenseUrl?: Express.Multer.File[],
            faceUrl?: Express.Multer.File[],
            avatarURL?: Express.Multer.File[],
            frontCccdUrl?: Express.Multer.File[],
            backCccdUrl?: Express.Multer.File[]
        },
        @Body() formData: any,
    ) {
        const doctorData = { ...formData };

        // Truyền đầy đủ thông tin file
        if (files?.licenseUrl?.[0]) {
            doctorData.licenseUrl = {
                buffer: files.licenseUrl[0].buffer,
                originalname: files.licenseUrl[0].originalname,
                mimetype: files.licenseUrl[0].mimetype,
            };
        }
        if (files?.faceUrl?.[0]) {
            doctorData.faceUrl = {
                buffer: files.faceUrl[0].buffer,
                originalname: files.faceUrl[0].originalname,
                mimetype: files.faceUrl[0].mimetype,
            };
        }
        if (files?.avatarURL?.[0]) {
            doctorData.avatarURL = {
                buffer: files.avatarURL[0].buffer,
                originalname: files.avatarURL[0].originalname,
                mimetype: files.avatarURL[0].mimetype,
            };
        }
        if (files?.frontCccdUrl?.[0]) {
            doctorData.frontCccdUrl = {
                buffer: files.frontCccdUrl[0].buffer,
                originalname: files.frontCccdUrl[0].originalname,
                mimetype: files.frontCccdUrl[0].mimetype,
            };
        }
        if (files?.backCccdUrl?.[0]) {
            doctorData.backCccdUrl = {
                buffer: files.backCccdUrl[0].buffer,
                originalname: files.backCccdUrl[0].originalname,
                mimetype: files.backCccdUrl[0].mimetype,
            };
        }

        return this.doctorService.applyForDoctor(userId, doctorData);
    }

    @Get('get-pending-doctor')
    //@UseGuards(JwtHybridAuthGuard, AdminGuard)
    getPendingDoctor() {
        return this.doctorService.getPendingDoctor();
    }

    @Get('get-pendingDoctor-by-id/:id')
    getPendingDoctorById(@Param('id') id: string) {
        return this.doctorService.getPendingDoctorById(id);
    }

    //@UseGuards(JwtHybridAuthGuard)
    @Get('getAvailableWorkingTime/:id')
    getAvailableWorkingTime(@Param('id') id: string, @Req() request: Request) {
        return this.doctorService.getAvailableWorkingTime(id);
    }

    @UseInterceptors(FileFieldsInterceptor([
        { name: 'license', maxCount: 1 },
        { name: 'image', maxCount: 1 },
        { name: 'frontCccd', maxCount: 1 },
        { name: 'backCccd', maxCount: 1 },
    ]))
    @Put(':id/update-profile')
    updateDoctorProfile(
        @Param('id') id: string,
        @UploadedFiles() files: { license?: Express.Multer.File[], image?: Express.Multer.File[], frontCccd?: Express.Multer.File[], backCccd?: Express.Multer.File[] },
        @Body() updateData: any) {
        if (files?.license?.[0]) {
            updateData.license = files.license[0];
        }

        if (files?.image?.[0]) {
            updateData.image = files.image[0];
        }

        if (files?.frontCccd?.[0]) {
            updateData.frontCccd = files.frontCccd[0];
        }

        if (files?.backCccd?.[0]) {
            updateData.backCccd = files.backCccd[0];
        }
        return this.doctorService.updateDoctorProfile(id, updateData);

    }

    @UseInterceptors(FileFieldsInterceptor([{ name: 'images', maxCount: 1 }]))
    @Post("doctor/:id/updateclinic")
    updateClinicInfo(
        @Param('id') id: string,
        @UploadedFiles() files: { images?: Express.Multer.File[] },
        @Body() updateData: any) {
        if (files?.images?.[0]) {
            updateData.images = files.images[0];
        }
        return this.doctorService.updateClinicInfo(id, updateData);
        }


}
