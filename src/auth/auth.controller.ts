import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import {
  SendOtpDto,
  VerifyOtpDto,
  SendEmailOtpDto,
  SendDirectEmailOtpDto,
  VerifyEmailOtpDto,
  LoginPasswordDto,
  UpdatePasswordDto,
} from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('send-otp')
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phone);
  }

  @Post('send-email-otp')
  async sendEmailOtp(@Body() dto: SendEmailOtpDto) {
    return this.authService.sendEmailOtp(dto.phone);
  }

  @Post('send-email-otp-direct')
  async sendDirectEmailOtp(@Body() dto: SendDirectEmailOtpDto) {
    return this.authService.sendDirectEmailOtp(dto.email);
  }

  @Post('verify-email-otp')
  async verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
    return this.authService.verifyEmailOtp(dto.email, dto.code, dto.referralCode);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.code, dto.referralCode);
  }

  @Post('login-password')
  async loginPassword(@Body() dto: LoginPasswordDto) {
    return this.authService.loginWithPassword(dto.phone, dto.password, dto.referralCode);
  }

  @Post('update-password')
  async updatePassword(
    @Body() dto: UpdatePasswordDto,
    @Headers('authorization') authHeader?: string,
  ) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('توکن احراز هویت الزامی است.');
    }
    const token = authHeader.replace('Bearer ', '').trim();
    const payload = this.jwtService.verify(token);
    return this.authService.updatePassword(payload.sub, dto.newPassword, dto.currentPassword);
  }

  @Get('me')
  async getMe(@Headers('authorization') authHeader?: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('توکن احراز هویت الزامی است.');
    }

    const token = authHeader.replace('Bearer ', '').trim();
    try {
      const payload = this.jwtService.verify(token);
      return this.authService.getMe(payload.sub);
    } catch (error) {
      throw new UnauthorizedException('توکن نامعتبر یا منقضی شده است.');
    }
  }
}
