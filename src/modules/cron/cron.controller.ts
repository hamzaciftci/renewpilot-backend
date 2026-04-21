import { Controller, Post, Get, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { CronService } from './cron.service';

/**
 * Cron endpoints — triggered by Vercel Cron.
 * Protected by CRON_SECRET header (x-cron-secret).
 *
 * Schedule (configured in vercel.json):
 *   0 8 * * *  — every day at 08:00 UTC
 */
@ApiExcludeController()
@Controller('cron')
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(
    private readonly cronService: CronService,
    private readonly config: ConfigService,
  ) {}

  private verifySecret(header?: string, authHeader?: string): void {
    const secret = this.config.get<string>('CRON_SECRET');
    if (!secret) {
      this.logger.warn('CRON_SECRET not set — allowing cron call without auth (dev mode)');
      return;
    }
    // Accept either x-cron-secret header or Authorization: Bearer <secret>
    const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
    const provided = header ?? bearerMatch?.[1];
    if (provided !== secret) {
      this.logger.warn('Unauthorized cron attempt');
      throw new UnauthorizedException('Invalid cron secret');
    }
  }

  @Post('send-reminders')
  @Get('send-reminders')
  async sendReminders(
    @Headers('x-cron-secret') secret?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    this.verifySecret(secret, authHeader);
    this.logger.log('🕐 Running daily reminders cron');
    const result = await this.cronService.runDailyReminders();
    return {
      ok: true,
      ...result,
      details: result.details.slice(0, 50), // Cap for response size
    };
  }

  /** Health check for cron endpoint (no auth required). */
  @Get('health')
  async health() {
    return { ok: true, timestamp: new Date().toISOString(), service: 'cron' };
  }
}
