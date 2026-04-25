import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebPushService } from './web-push.service';

/**
 * Tiny module so both PushModule (browser subscribe API) and
 * NotificationsServerlessModule (dispatcher) can share a single
 * WebPushService instance without dragging the rest of either module along.
 */
@Module({
  imports: [ConfigModule],
  providers: [WebPushService],
  exports: [WebPushService],
})
export class WebPushModule {}
