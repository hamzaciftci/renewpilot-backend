import { InjectQueue } from '@nestjs/bull';
import { Injectable, Optional } from '@nestjs/common';
import { NotificationStatus } from '@prisma/client';
import type { Queue } from 'bull';
import { REMINDERS_QUEUE } from '../../common/queues/queues.module';
import { PrismaService } from '../../common/db/prisma.service';
import { SEND_REMINDER_JOB } from './processors/reminder.processor';

export interface UpdatePreferencesDto {
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  smsEnabled?: boolean;
  whatsappEnabled?: boolean;
  quietHoursStart?: number | string;
  quietHoursEnd?: number | string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    @Optional() @InjectQueue(REMINDERS_QUEUE) private remindersQueue?: Queue,
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

  async getPreferences(organizationId: string, userId: string) {
    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });

    if (!prefs) {
      return {
        emailEnabled: true,
        pushEnabled: true,
        smsEnabled: false,
        whatsappEnabled: false,
        quietHoursStart: '22',
        quietHoursEnd: '8',
      };
    }

    return prefs;
  }

  async updatePreferences(organizationId: string, userId: string, dto: UpdatePreferencesDto) {
    const quietStart = dto.quietHoursStart !== undefined ? String(dto.quietHoursStart) : undefined;
    const quietEnd = dto.quietHoursEnd !== undefined ? String(dto.quietHoursEnd) : undefined;

    return this.prisma.notificationPreference.upsert({
      where: { userId_organizationId: { userId, organizationId } },
      create: {
        userId,
        organizationId,
        emailEnabled: dto.emailEnabled ?? true,
        pushEnabled: dto.pushEnabled ?? true,
        smsEnabled: dto.smsEnabled ?? false,
        whatsappEnabled: dto.whatsappEnabled ?? false,
        quietHoursStart: quietStart ?? '22',
        quietHoursEnd: quietEnd ?? '8',
      },
      update: {
        ...(dto.emailEnabled !== undefined && { emailEnabled: dto.emailEnabled }),
        ...(dto.pushEnabled !== undefined && { pushEnabled: dto.pushEnabled }),
        ...(dto.smsEnabled !== undefined && { smsEnabled: dto.smsEnabled }),
        ...(dto.whatsappEnabled !== undefined && { whatsappEnabled: dto.whatsappEnabled }),
        ...(quietStart !== undefined && { quietHoursStart: quietStart }),
        ...(quietEnd !== undefined && { quietHoursEnd: quietEnd }),
      },
    });
  }

  async enqueueReminder(notificationId: string, scheduledFor: Date) {
    if (!this.remindersQueue) {
      console.warn('[notifications] Queue not available, skipping reminder enqueue');
      return;
    }
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
