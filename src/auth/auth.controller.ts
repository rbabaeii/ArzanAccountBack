import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 3, ttl: 120000 } })
  @Post('send-otp')
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phone);
  }

  @Throttle({ default: { limit: 3, ttl: 120000 } })
  @Post('send-email-otp')
  async sendEmailOtp(@Body() dto: SendEmailOtpDto) {
    return this.authService.sendEmailOtp(dto.phone);
  }

  @Throttle({ default: { limit: 3, ttl: 120000 } })
  @Post('send-email-otp-direct')
  async sendDirectEmailOtp(@Body() dto: SendDirectEmailOtpDto) {
    return this.authService.sendDirectEmailOtp(dto.email);
  }

  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Post('verify-email-otp')
  async verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
    return this.authService.verifyEmailOtp(dto.email, dto.code, dto.referralCode);
  }

  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.code, dto.referralCode);
  }

  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Post('login-password')
  async loginPassword(@Body() dto: LoginPasswordDto) {
    return this.authService.loginWithPassword(dto.phone, dto.password, dto.referralCode);
  }

  @UseGuards(JwtAuthGuard)
  @Post('update-password')
  async updatePassword(
    @Body() dto: UpdatePasswordDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.authService.updatePassword(userId, dto.newPassword, dto.currentPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }
}
