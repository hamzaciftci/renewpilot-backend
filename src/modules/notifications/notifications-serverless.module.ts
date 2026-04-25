import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationDispatcherService } from './dispatchers/notification-dispatcher.service';
import { WebPushModule } from './dispatchers/web-push.module';

@Module({
  imports: [ConfigModule, WebPushModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, OrgScopeGuard, NotificationDispatcherService],
  exports: [NotificationsService, NotificationDispatcherService, WebPushModule],
})
export class NotificationsServerlessModule {}
