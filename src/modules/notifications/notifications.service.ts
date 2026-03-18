import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { NotificationStatus } from '@prisma/client';
import type { Queue } from 'bull';
import { REMINDERS_QUEUE } from '../../common/queues/queues.module';
import { PrismaService } from '../../common/db/prisma.service';
import { SEND_REMINDER_JOB } from './processors/reminder.processor';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue(REMINDERS_QUEUE) private remindersQueue: Queue,
  ) {}

  async getForUser(organizationId: string, userId: string) {
    return this.prisma.notification.findMany({
      where: { organizationId, userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(organizationId: string, userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, organizationId, userId },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
  }

  async getUnreadCount(organizationId: string, userId: string) {
    const count = await this.prisma.notification.count({
      where: {
        organizationId,
        userId,
        status: { in: [NotificationStatus.SENT, NotificationStatus.DELIVERED] },
        readAt: null,
      },
    });
    return { count };
  }

  async enqueueReminder(notificationId: string, scheduledFor: Date) {
    const delay = Math.max(0, scheduledFor.getTime() - Date.now());
    await this.remindersQueue.add(
      SEND_REMINDER_JOB,
      { notificationId },
      {
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
      },
    );
  }
}
