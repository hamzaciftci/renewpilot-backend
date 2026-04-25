import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/db/prisma.service';
import { WebPushService } from '../notifications/dispatchers/web-push.service';
import { PushSubscribeDto, PushUnsubscribeDto } from './dto/push-subscribe.dto';

/**
 * Browser Web Push (VAPID) endpoints.
 *
 * Flow:
 *  1. Client GETs /push/public-key, uses it to call PushManager.subscribe()
 *  2. Client POSTs the resulting subscription to /push/subscribe
 *  3. When notifications fire, the dispatcher sends to all stored subs
 *  4. Client may DELETE /push/subscribe to opt out
 */
@ApiTags('Push')
@ApiBearerAuth()
@Controller('push')
export class PushController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webPush: WebPushService,
  ) {}

  /**
   * Public key is non-secret (it's literally meant to be embedded in clients);
   * we leave this endpoint open so the bundle can request it before login if
   * we ever want anonymous push (we currently don't).
   */
  @Get('public-key')
  @ApiOperation({ summary: 'Get the VAPID public key for browser subscriptions' })
  getPublicKey() {
    return { publicKey: this.webPush.getPublicKey() };
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Register a browser push subscription for the current user' })
  async subscribe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: PushSubscribeDto,
  ) {
    // Upsert by endpoint — if the same browser re-subscribes (e.g. after
    // permission reset), reuse the row but rebind to the current user.
    const sub = await this.prisma.webPushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId: user.userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent,
      },
      update: {
        userId: user.userId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent,
      },
      select: { id: true, createdAt: true },
    });

    return { id: sub.id, createdAt: sub.createdAt };
  }

  @Delete('subscribe')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a browser push subscription' })
  async unsubscribe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: PushUnsubscribeDto,
  ) {
    // Only delete if it belongs to this user — never let one user delete
    // another's sub.
    await this.prisma.webPushSubscription.deleteMany({
      where: { endpoint: dto.endpoint, userId: user.userId },
    });
  }

  @Get('subscriptions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List the current user\'s push subscriptions' })
  async listSubscriptions(@CurrentUser() user: JwtPayload) {
    const subs = await this.prisma.webPushSubscription.findMany({
      where: { userId: user.userId },
      select: {
        id: true,
        endpoint: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return subs;
  }
}
