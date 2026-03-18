import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { REMINDERS_QUEUE } from '../../common/queues/queues.module';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { NotificationsService } from './notifications.service';
import { ReminderProcessor } from './processors/reminder.processor';

@Module({
  imports: [BullModule.registerQueue({ name: REMINDERS_QUEUE })],
  providers: [NotificationsService, ReminderProcessor, OrgScopeGuard],
  exports: [NotificationsService],
})
export class NotificationsModule {}
