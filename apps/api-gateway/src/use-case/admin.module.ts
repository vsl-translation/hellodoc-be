import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminController } from '../controller/admin.controller';
import { AdminService } from '../services/admin.service';

@Module({
    imports: [
        HttpModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                timeout: 5000,
                maxRedirects: 5,
                baseURL: configService.get('ADMIN_SERVICE_URL') || 'http://localhost:3010',
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule { }