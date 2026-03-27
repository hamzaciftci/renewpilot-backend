import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationStatus } from '@prisma/client';
import type { Job } from 'bull';
import { Resend } from 'resend';
import { REMINDERS_QUEUE } from '../../../common/queues/queues.module';
import { PrismaService } from '../../../common/db/prisma.service';

export const SEND_REMINDER_JOB = 'send-reminder';

interface ReminderJobData {
  notificationId: string;
}

@Processor(REMINDERS_QUEUE)
export class ReminderProcessor {
  private readonly logger = new Logger(ReminderProcessor.name);
  private resend: Resend | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (apiKey && apiKey !== 're_placeholder') {
      this.resend = new Resend(apiKey);
    }
  }

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
    const from = this.config.get<string>('EMAIL_FROM', 'noreply@renewpilot.io');
    const assetName = notification.asset?.name ?? 'your asset';
    const renewalDate = notification.asset?.renewalDate
      ? new Date(notification.asset.renewalDate).toLocaleDateString('tr-TR')
      : '';

    if (!this.resend) {
      this.logger.log(
        `[EMAIL STUB] To: ${notification.user.email} | Subject: ${notification.subject} | Asset: ${assetName}`,
      );
      return;
    }

    await this.resend.emails.send({
      from,
      to: notification.user.email,
      subject: notification.subject ?? `Renewal Reminder: ${assetName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1;">RenewPilot Reminder</h2>
          <p>Hi ${notification.user.fullName ?? 'there'},</p>
          <p>${notification.body}</p>
          ${renewalDate ? `<p><strong>Renewal Date:</strong> ${renewalDate}</p>` : ''}
          <a href="${this.config.get('FRONTEND_URL', 'https://renewpilot.vercel.app')}/renewals"
             style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">
            View in RenewPilot
          </a>
          <p style="color:#888;font-size:12px;margin-top:24px;">
            You're receiving this because you have a renewal reminder set for this asset.
          </p>
        </div>
      `,
    });

    this.logger.log(`Email sent to ${notification.user.email} for asset: ${assetName}`);
  }

  private async dispatchPush(notification: any) {
    // TODO: integrate Firebase Cloud Messaging
    this.logger.log(
      `[PUSH STUB] UserId: ${notification.userId} | Body: ${notification.body}`,
    );
  }
}
