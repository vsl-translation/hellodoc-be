import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { loginDto } from "../core/dto/login.dto";
import { LoginGoogleDto } from "../core/dto/loginGoogle.dto";
import { AuthService } from "../services/auth.service";
import { SignupDto } from "../core/dto/signup.dto";

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('signup')
    async signUp(@Body() signUpData: SignupDto) {
        return this.authService.signUp(signUpData);
    }

    @Post('signupAdmin')
    async signUpAdmin(@Body() signUpData: SignupDto) {
        return this.authService.signUpAdmin(signUpData);
    }

    @Post('login')
    async login(@Body() credentials: loginDto) {
        return this.authService.login(credentials);
    }

    @Post('login-google')
    async loginGoogle(@Body() loginGoogleData: LoginGoogleDto) {
        return this.authService.loginGoogle(loginGoogleData);
    }

    // Gửi OTP qua email
    @Post('request-otp')
    async requestOtp(@Body('email') email: string) {
        if (!email) {
            throw new BadRequestException('Email không được để trống');
        }

        return this.authService.requestOTP(email);
    }

    @Post('request-otp-signup')
    async requestOtpForSignUp(@Body('email') email: string) {
        if (!email) {
            throw new BadRequestException('Email không được để trống');
        }

        return this.authService.requestOtpSignup(email);
    }

    // Xác minh OTP
    @Post('verify-otp')
    async verifyOtp(
        @Body('email') email: string,
        @Body('otp') otp: string,
    ) {
        if (!email || !otp) {
            throw new BadRequestException('Email và OTP là bắt buộc');
        }

        return this.authService.verifyOTP(email, otp);
    }

    @Post('reset-password')
    async resetPassword(
        @Body('email') email: string,
        @Body('newPassword') newPassword: string
    ) {
        return this.authService.resetPassword(email, newPassword);
    }

    @Post('generate-token')
    async generateTokenGoogle(@Body() { email }: { email: string, }) {
        return this.authService.generateGoogleTokens(email);

    }
}