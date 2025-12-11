import { BadRequestException, Inject, Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { SignupDto } from "apps/auth/src/core/dto/signup.dto";
import { LoginGoogleDto } from "../core/dto/loginGoogle.dto";
import { loginDto } from "../core/dto/login.dto";
import { firstValueFrom } from "rxjs";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { AxiosError } from "axios";

@Injectable()
export class AuthService {
    private readonly baseUrl: string;
    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.baseUrl = this.configService.get('AUTH_SERVICE_URL') || 'http://localhost:3005';
    }
    // Helper method để xử lý lỗi HTTP
    private handleHttpError(error: AxiosError) {
        if (error.response) {
            const status = error.response.status;
            const message = (error.response.data as any)?.message || 'Service error';

            if (status === 401) {
                throw new UnauthorizedException(message);
            }
            if (status === 400) {
                throw new BadRequestException(message);
            }
            throw new InternalServerErrorException(message);
        }
        throw new InternalServerErrorException('Service unavailable');
    }

    async signUp(signUpData: SignupDto) {
        return this.httpService.post(`${this.baseUrl}/auth/signUp`, signUpData);
    }

    async login(loginData: loginDto) {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/auth/login`, loginData)
            );

            const result = response.data;

            // Kiểm tra kết quả và throw exception nếu cần
            if (!result.success) {
                if (result.statusCode === 401) {
                    throw new UnauthorizedException(result.message);
                }
                if (result.statusCode === 400) {
                    throw new BadRequestException(result.message);
                }
                throw new InternalServerErrorException(result.message);
            }

            // Trả về kết quả thành công
            return {
                accessToken: result.accessToken,
                message: result.message
            };
        } catch (error) {
            // Nếu đã là HTTP Exception từ logic trên, throw lại
            if (error instanceof UnauthorizedException ||
                error instanceof BadRequestException ||
                error instanceof InternalServerErrorException) {
                throw error;
            }
            // Nếu là lỗi HTTP từ axios
            this.handleHttpError(error as AxiosError);
        }
    }


    async loginGoogle(loginGoogleData: LoginGoogleDto) {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/auth/login-google`, loginGoogleData)
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

    async requestOTP(email: string) {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/auth/request-otp`, { email })
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

    async requestOtpSignup(email: string) {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/auth/request-otp-signup`, { email })
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

    async verifyOTP(email: string, otp: string) {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/auth/verify-otp`, { email, otp })
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

    async resetPassword(email: string, password: string) {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/auth/reset-password`, { email, newPassword: password })
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

    async generateGoogleTokens(email: string) {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/auth/generate-token`, { email })
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

    async signUpAdmin(signUpData: SignupDto) {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/auth/createAdmin`, signUpData)
            );
            return response.data;
        } catch (error) {
            this.handleHttpError(error as AxiosError);
        }
    }

}