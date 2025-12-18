import { BadRequestException, Inject, Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { SignupDto } from "apps/auth/src/core/dto/signup.dto";
import { LoginGoogleDto } from "../core/dto/loginGoogle.dto";
import { loginDto } from "../core/dto/login.dto";
import { firstValueFrom } from "rxjs";

@Injectable()
export class AuthService {
    constructor(
        @Inject('AUTH_CLIENT') private authClient: ClientProxy
    ) { }

    private handleResult(result: any) {
        if (!result.success) {
            console.error('Microservice Error:', result);
            const message = result.message || 'Lỗi hệ thống';
            if (result.statusCode === 401) {
                throw new UnauthorizedException(message);
            }
            if (result.statusCode === 400) {
                throw new BadRequestException(message);
            }
            if (result.statusCode === 404) {
                throw new BadRequestException(message);
            }
            throw new InternalServerErrorException(message);
        }
        
        // Trả về kết quả sạch (loại bỏ success và statusCode)
        const { success, statusCode, ...data } = result;
        return data;
    }

    async login(loginData: loginDto) {
        const result = await firstValueFrom(
            this.authClient.send('auth.login', loginData)
        );
        return this.handleResult(result);
    }

    async loginGoogle(loginGoogleData: LoginGoogleDto) {
        const result = await firstValueFrom(
            this.authClient.send('auth.login-google', loginGoogleData)
        );
        return this.handleResult(result);
    }

    async requestOTP(email: string) {
        const result = await firstValueFrom(
            this.authClient.send('auth.request-otp', { email })
        );
        return this.handleResult(result);
    }

    async requestOtpSignup(email: string) {
        const result = await firstValueFrom(
            this.authClient.send('auth.request-otp-signup', { email })
        );
        return this.handleResult(result);
    }

    async verifyOTP(email: string, otp: string) {
        const result = await firstValueFrom(
            this.authClient.send('auth.verify-otp', { email, otp })
        );
        return this.handleResult(result);
    }

    async resetPassword(email: string, password: string) {
        const result = await firstValueFrom(
            this.authClient.send('auth.reset-password', { email, password })
        );
        return this.handleResult(result);
    }

    async generateGoogleTokens(email: string) {
        const result = await firstValueFrom(
            this.authClient.send('auth.generate-token', { email })
        );
        return this.handleResult(result);
    }

    async signUpAdmin(signUpData: SignupDto) {
        const result = await firstValueFrom(
            this.authClient.send('auth.createAdmin', signUpData)
        );
        return this.handleResult(result);
    }

    async signUp(signUpData: SignupDto) {
        const result = await firstValueFrom(
            this.authClient.send('auth.signUp', signUpData)
        );
        return this.handleResult(result);
    }
}
