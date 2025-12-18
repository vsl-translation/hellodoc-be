import { BadRequestException, Body, Controller, Get } from '@nestjs/common';
import { AuthService } from '../service/auth.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SignupDto } from '../core/dto/signup.dto';
import { LoginGoogleDto } from '../core/dto/loginGoogle.dto';
import { loginDto } from '../core/dto/login.dto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @MessagePattern('auth.signUp')
  async signup(@Payload() signUpData: SignupDto) {
    try {
      const result = await this.authService.signup(signUpData);
      return { success: true, statusCode: 200, message: 'Tạo tài khoản thành công', data: result };
    } catch (error) {
      return { success: false, statusCode: error.status || 500, message: error.message };
    }
  }

  @MessagePattern('auth.createAdmin')
  async signupAdmin(@Payload() signUpData: SignupDto) {
    try {
      const result = await this.authService.signupAdmin(signUpData);
      return { success: true, statusCode: 200, message: 'Tạo tài khoản admin thành công', data: result };
    } catch (error) {
      return { success: false, statusCode: error.status || 500, message: error.message };
    }
  }

  @MessagePattern('auth.login')
  async login(@Payload() loginData: loginDto) {
    try {
      const result = await this.authService.login(loginData);
      // login service already returns object with success/statusCode
      return result;
    } catch (error) {
      return { success: false, statusCode: error.status || 500, message: error.message };
    }
  }

  @MessagePattern('auth.login-google')
  async loginAdmin(@Payload() loginData: LoginGoogleDto) {
    try {
      const result = await this.authService.loginGoogle(loginData);
      // loginGoogle service doesn't have success/statusCode yet, let's wrap it
      return { success: true, statusCode: 200, ...result };
    } catch (error) {
      return { success: false, statusCode: error.status || 500, message: error.message };
    }
  }

  @MessagePattern('auth.request-otp')
  async requestOtp(@Payload() data: { email: string }) {
    console.log('requestOtp service');
    if (!data.email) {
      return { success: false, statusCode: 400, message: 'Email không được để trống' };
    }

    try {
      const otp = await this.authService.requestOtp(data.email);
      return { success: true, statusCode: 200, message: 'OTP đã được gửi tới email', otp };
    } catch (error) {
      return { success: false, statusCode: error.status || 500, message: error.message };
    }
  }

  @MessagePattern('auth.request-otp-signup')
  async requestOtpSignup(@Payload() data: { email: string }) {
    if (!data.email) {
      return { success: false, statusCode: 400, message: 'Email không được để trống' };
    }

    try {
      const otp = await this.authService.requestOtpSignup(data.email);
      return { success: true, statusCode: 200, message: 'OTP đã được gửi đến email', otp };
    } catch (error) {
      return { success: false, statusCode: error.status || 500, message: error.message };
    }
  }

  @MessagePattern('auth.verify-otp')
  async verifyOtp(@Payload() data: { email: string, otp: string }) {
    if (!data.email || !data.otp) {
      return { success: false, statusCode: 400, message: 'Email và OTP là bắt buộc' };
    }

    try {
      const isValid = await this.authService.verifyOTP(data.email, data.otp);

      if (!isValid) {
        return { success: false, statusCode: 400, message: 'OTP không hợp lệ hoặc đã hết hạn' };
      }

      return { success: true, statusCode: 200, message: 'Xác minh OTP thành công' };
    } catch (error) {
      return { success: false, statusCode: error.status || 500, message: error.message };
    }
  }

  @MessagePattern('auth.reset-password')
  async resetPassword(@Payload() data: { email: string, password: string }) {
    try {
      await this.authService.resetPassword(data.email, data.password);
      return { success: true, statusCode: 200, message: 'Mật khẩu đã được cập nhật thành công' };
    } catch (error) {
      return { success: false, statusCode: error.status || 500, message: error.message };
    }
  }

  @MessagePattern('auth.generate-token')
  async generateToken(@Payload() data: { email: string }) {
    try {
      const result = await this.authService.generateGoogleTokens(data.email);
      return { success: true, statusCode: 200, ...result };
    } catch (error) {
      return { success: false, statusCode: error.status || 500, message: error.message };
    }
  }
}
