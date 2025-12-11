import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from '../service/auth.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SignupDto } from '../core/dto/signup.dto';
import { LoginGoogleDto } from '../core/dto/loginGoogle.dto';
import { loginDto } from '../core/dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('signUp')
  async signup(@Body() signUpData: SignupDto) {
    return this.authService.signup(signUpData);
  }

  @Post('createAdmin')
  async signupAdmin(@Body() signUpData: SignupDto) {
    return this.authService.signupAdmin(signUpData);
  }

  @Post('login')
  async login(@Body() loginData: loginDto) {
    return this.authService.login(loginData);
  }

  @Post('login-google')
  async loginAdmin(@Body() loginData: LoginGoogleDto) {
    return this.authService.loginGoogle(loginData);
  }

  @Post('request-otp')
  async requestOtp(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Emil không được để trống')
    }

    const otp = await this.authService.requestOtp(email);
    return { message: 'OTP đã được gửi tới email', otp };
  }

  @Post('request-otp-signup')
  async requestOtpSignup(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email không được để trống');
    }

    const otp = await this.authService.requestOtpSignup(email);
    return { message: 'OTP đã được gửi đến email', otp };
  }

  @Post('verify-otp')
  async verifyOtp(@Body('email') email: string, @Body('otp') otp: string) {
    if (!email || !otp) {
      throw new BadRequestException('Email và OTP là bắt buộc');
    }

    const isValid = await this.authService.verifyOTP(email, otp);

    if (!isValid) {
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
    }

    return { message: 'Xác minh OTP thành công' };
  }

  @Post('reset-password')
  async resetPassword(@Body('email') email: string, @Body('newPassword') password: string) {
    // Cập nhật mật khẩu mới (hash trước khi lưu)
    await this.authService.resetPassword(email, password);

    return { message: 'Mật khẩu đã được cập nhật thành công' };
  }

  @Post('generate-token')
  async generateToken(@Body('email') email: string) {
    return this.authService.generateGoogleTokens(email);
  }
}
