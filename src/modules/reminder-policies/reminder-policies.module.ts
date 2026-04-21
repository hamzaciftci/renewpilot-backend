import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/db/prisma.module';
import { ReminderPoliciesController } from './reminder-policies.controller';
import { ReminderPoliciesService } from './reminder-policies.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReminderPoliciesController],
  providers: [ReminderPoliciesService],
  exports: [ReminderPoliciesService],
})
export class ReminderPoliciesModule {}
