import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { REMINDERS_QUEUE } from '../../../common/queues/queues.module';
import { PrismaService } from '../../../common/db/prisma.service';
import { NotificationStatus } from '@prisma/client';

export const SEND_REMINDER_JOB = 'send-reminder';

interface ReminderJobData {
  notificationId: string;
}

@Processor(REMINDERS_QUEUE)
export class ReminderProcessor {
  private readonly logger = new Logger(ReminderProcessor.name);

  constructor(private prisma: PrismaService) {}

  @Process(SEND_REMINDER_JOB)
  async handleSendReminder(job: Job<ReminderJobData>) {
    const { notificationId } = job.data;
    this.logger.log(`Processing reminder job for notification: ${notificationId}`);

    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        asset: { select: { name: true, assetType: true, renewalDate: true } },
        user: { select: { email: true, fullName: true } },
      },
    });

    if (!notification) {
      this.logger.warn(`Notification ${notificationId} not found — skipping`);
      return;
    }

    if (notification.status !== NotificationStatus.PENDING) {
      this.logger.warn(`Notification ${notificationId} already processed (${notification.status}) — skipping`);
      return;
    }

    try {
      // Channel dispatch — stubbed, replace with real providers
      switch (notification.channel) {
        case 'EMAIL':
          await this.dispatchEmail(notification);
          break;
        case 'PUSH':
          await this.dispatchPush(notification);
          break;
        default:
          this.logger.warn(`Channel ${notification.channel} not yet implemented`);
      }

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
        },
      });

      this.logger.log(`Reminder sent successfully for notification: ${notificationId}`);
    } catch (err) {
      this.logger.error(`Failed to send reminder ${notificationId}: ${err}`);

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.FAILED,
          failedAt: new Date(),
          failureReason: String(err),
          retryCount: { increment: 1 },
        },
      });

      throw err; // Re-throw to allow Bull to retry
    }
  }

  private async dispatchEmail(notification: any) {
    // TODO: integrate Resend / Postmark
    this.logger.log(
      `[EMAIL STUB] To: ${notification.user.email} | Subject: ${notification.subject} | Asset: ${notification.asset?.name}`,
    );
  }

  private async dispatchPush(notification: any) {
    // TODO: integrate Firebase Cloud Messaging
    this.logger.log(
      `[PUSH STUB] UserId: ${notification.userId} | Body: ${notification.body}`,
    );
  }
}
