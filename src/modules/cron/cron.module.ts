import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/db/prisma.module';
import { CronController } from './cron.controller';
import { CronService } from './cron.service';
import { NotificationDispatcherService } from '../notifications/dispatchers/notification-dispatcher.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [CronController],
  providers: [CronService, NotificationDispatcherService],
  exports: [CronService, NotificationDispatcherService],
})
export class CronModule {}
