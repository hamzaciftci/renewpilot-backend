import { Module } from '@nestjs/common';
import { WebPushModule } from '../notifications/dispatchers/web-push.module';
import { PushController } from './push.controller';

/**
 * Web Push (VAPID) browser-subscription endpoints.
 * Pulls in WebPushModule so we share a single VAPID-configured service
 * with the notifications dispatcher.
 */
@Module({
  imports: [WebPushModule],
  controllers: [PushController],
})
export class PushModule {}
