import { Module } from '@nestjs/common';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, OrgScopeGuard],
  exports: [NotificationsService],
})
export class NotificationsServerlessModule {}
