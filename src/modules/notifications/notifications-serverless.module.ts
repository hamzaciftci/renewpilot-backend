import { Module } from '@nestjs/common';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [NotificationsService, OrgScopeGuard],
  exports: [NotificationsService],
})
export class NotificationsServerlessModule {}
