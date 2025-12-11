import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from '../controller/auth.controller';
import { AuthService } from '../services/auth.service';

@Module({
    imports: [
        HttpModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                timeout: 5000,
                maxRedirects: 5,
                baseURL: configService.get('AUTH_SERVICE_URL') || 'http://localhost:3005',
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService],
})
export class AuthModule { }