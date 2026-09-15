import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { getEnvironmentConfig } from '../../config/env.js';

function extractCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]).trim() : null;
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const config = getEnvironmentConfig();

    const authHeader = request.headers['authorization'];
    const secretHeader = request.headers['x-admin-secret'];
    const cookieHeader = request.headers['cookie'];

    let providedSecret = '';

    if (secretHeader && typeof secretHeader === 'string') {
      providedSecret = secretHeader.trim();
    } else if (authHeader && typeof authHeader === 'string') {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        providedSecret = parts[1].trim();
      }
    } else if (cookieHeader && typeof cookieHeader === 'string') {
      const cookieVal = extractCookie(cookieHeader, 'war_admin_token');
      if (cookieVal) {
        providedSecret = cookieVal;
      }
    }

    if (!providedSecret || (providedSecret !== config.adminSecret && providedSecret !== config.jwtSecret)) {
      throw new UnauthorizedException('Akses admin tidak sah.');
    }

    return true;
  }
}
