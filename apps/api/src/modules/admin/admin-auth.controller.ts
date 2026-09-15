import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UnauthorizedException,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { IsNotEmpty, IsString } from 'class-validator';
import { getEnvironmentConfig } from '../../config/env.js';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard.js';

export class AdminLoginDto {
  @IsNotEmpty({ message: 'Kunci rahasia admin wajib diisi.' })
  @IsString({ message: 'Kunci rahasia admin harus berupa string.' })
  secret!: string;
}

@Controller('admin/auth')
export class AdminAuthController {
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: AdminLoginDto, @Res({ passthrough: true }) res: Response) {
    const config = getEnvironmentConfig();
    const secret = body?.secret?.trim();

    if (!secret || (secret !== config.adminSecret && secret !== config.jwtSecret)) {
      throw new UnauthorizedException('Kunci rahasia admin tidak valid.');
    }

    const isProd = config.nodeEnv === 'production';

    res.cookie('war_admin_token', secret, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    return {
      success: true,
      message: 'Autentikasi admin berhasil.',
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    const config = getEnvironmentConfig();
    const isProd = config.nodeEnv === 'production';

    res.clearCookie('war_admin_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
    });

    return {
      success: true,
      message: 'Sesi admin berhasil diakhiri.',
    };
  }

  @Get('verify')
  @UseGuards(AdminAuthGuard)
  async verifyAuthGet() {
    return {
      success: true,
      authenticated: true,
      message: 'Autentikasi admin valid.',
    };
  }

  @Post('verify')
  @UseGuards(AdminAuthGuard)
  async verifyAuthPost() {
    return {
      success: true,
      authenticated: true,
      message: 'Autentikasi admin valid.',
    };
  }
}
