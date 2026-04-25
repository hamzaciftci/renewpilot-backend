import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/db/prisma.service';
import { NotificationDispatcherService } from '../notifications/dispatchers/notification-dispatcher.service';
import {
  renderRenewalReminderEmail,
  renderRenewalReminderSms,
  RenewalReminderData,
} from '../notifications/templates/renewal-reminder.template';
import { addInterval, daysUntilExpiry, getExpiryStatus } from '../../common/utils/date.utils';
import { MemberRole, NotificationChannel, NotificationStatus, RenewalEventType } from '@prisma/client';

/**
 * Default reminder offsets (days):
 *  Positive = days BEFORE renewal. Negative = days AFTER renewal (escalation).
 *  60d, 30d, 14d, 7d, 3d, 1d, 0 (on date), then 1, 3, 7, 14 days AFTER expiry.
 */
const DEFAULT_OFFSETS = [60, 30, 14, 7, 3, 1, 0, -1, -3, -7, -14];
const DEFAULT_CHANNELS = { email: true, sms: false, whatsapp: false, push: false };

interface RecipientInfo {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
}

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  async runDailyReminders(): Promise<{
    processed: number;
    sent: number;
    skipped: number;
    failed: number;
    details: string[];
  }> {
    const startedAt = Date.now();
    const result = { processed: 0, sent: 0, skipped: 0, failed: 0, details: [] as string[] };
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Credit cards recur monthly: any whose renewalDate is in the past gets rolled forward
    // so the upcoming month's due date lines up with the reminder offsets.
    await this.rollForwardOverdueCreditCards(today);

    // Fetch all non-deleted, non-archived, non-cancelled assets across all orgs
    const assets = await this.prisma.asset.findMany({
      where: {
        deletedAt: null,
        status: { in: ['ACTIVE', 'EXPIRING_SOON', 'EXPIRED'] },
        organization: { deletedAt: null, status: 'ACTIVE' },
      },
      include: {
        organization: {
          include: {
            reminderPolicies: { where: { isDefault: true }, take: 1 },
            members: {
              where: { role: { in: [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MEMBER] } },
              include: {
                user: {
                  select: { id: true, email: true, fullName: true, phoneNumber: true, deletedAt: true },
                },
              },
            },
          },
        },
        assignedUser: { select: { id: true, email: true, fullName: true, phoneNumber: true } },
      },
    });

    this.logger.log(`Scanning ${assets.length} assets across all orgs`);
    result.processed = assets.length;

    for (const asset of assets) {
      // Calculate days until renewal (UTC)
      const renewal = new Date(asset.renewalDate);
      const renewalUtc = new Date(Date.UTC(renewal.getUTCFullYear(), renewal.getUTCMonth(), renewal.getUTCDate()));
      const daysUntil = Math.floor((renewalUtc.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

      // Org's reminder policy (or defaults)
      const policy = asset.organization.reminderPolicies[0];
      const offsets: number[] = (policy?.offsetDays as number[]) ?? DEFAULT_OFFSETS;
      const channels: Record<string, boolean> =
        (policy?.channelConfig as Record<string, boolean>) ?? DEFAULT_CHANNELS;

      // Does today match an offset?
      if (!offsets.includes(daysUntil)) continue;

      // Determine recipients: assigned user + org owners/admins
      const recipients = this.collectRecipients(asset);
      if (recipients.length === 0) {
        result.skipped++;
        continue;
      }

      // Build notification content once
      const dashboardUrl =
        this.config.get<string>('FRONTEND_URL') ?? 'https://renewpilot.vercel.app';

      for (const recipient of recipients) {
        // Fetch user preferences for this org (if any)
        const pref = await this.prisma.notificationPreference.findUnique({
          where: {
            userId_organizationId: {
              userId: recipient.id,
              organizationId: asset.organizationId,
            },
          },
        });

        const templateData: RenewalReminderData = {
          recipientName: recipient.fullName,
          assetName: asset.name,
          assetType: asset.assetType,
          vendorName: asset.vendorName,
          renewalDate: asset.renewalDate.toISOString(),
          daysUntil,
          price: asset.priceAmount
            ? `${asset.priceCurrency} ${asset.priceAmount.toString()}`
            : null,
          dashboardUrl,
          metadata: asset.metadata as Record<string, unknown> | null,
        };

        const enabledChannels: NotificationChannel[] = [];
        if (channels.email !== false && pref?.emailEnabled !== false) enabledChannels.push('EMAIL');
        if (channels.sms === true && (pref?.smsEnabled !== false) && recipient.phoneNumber) enabledChannels.push('SMS');
        if (channels.whatsapp === true && (pref?.whatsappEnabled !== false) && recipient.phoneNumber) enabledChannels.push('WHATSAPP');
        if (channels.push === true && pref?.pushEnabled !== false) enabledChannels.push('PUSH');

        for (const channel of enabledChannels) {
          // Dedup check: has a notification with same asset+type+channel been sent in last 23 hours?
          const notifType = this.buildNotificationType(daysUntil);
          const duplicateCheckSince = new Date(Date.now() - 23 * 60 * 60 * 1000);

          const existing = await this.prisma.notification.findFirst({
            where: {
              assetId: asset.id,
              userId: recipient.id,
              channel,
              notificationType: notifType,
              status: { in: [NotificationStatus.SENT, NotificationStatus.DELIVERED, NotificationStatus.READ] },
              sentAt: { gte: duplicateCheckSince },
            },
          });

          if (existing) {
            result.skipped++;
            continue;
          }

          // Render content per channel
          const emailContent = renderRenewalReminderEmail(templateData);
          const smsText = renderRenewalReminderSms(templateData);

          const subject = emailContent.subject;
          const body = channel === 'EMAIL' ? emailContent.text : smsText;
          const html = channel === 'EMAIL' ? emailContent.html : undefined;

          // Create notification record
          const notification = await this.prisma.notification.create({
            data: {
              organizationId: asset.organizationId,
              userId: recipient.id,
              assetId: asset.id,
              channel,
              notificationType: notifType,
              subject,
              body,
              status: NotificationStatus.PENDING,
              scheduledFor: now,
              payload: {
                daysUntil,
                assetType: asset.assetType,
                policyId: policy?.id ?? null,
              },
            },
          });

          // Dispatch
          const dispatchResult = await this.dispatcher.dispatch({
            to: {
              userId: recipient.id,
              email: recipient.email,
              phoneNumber: recipient.phoneNumber ?? undefined,
              fullName: recipient.fullName,
            },
            channel,
            subject,
            body,
            html,
            pushUrl: `/assets/${asset.id}`,
          });

          if (dispatchResult.success) {
            await this.prisma.notification.update({
              where: { id: notification.id },
              data: {
                status: NotificationStatus.SENT,
                sentAt: new Date(),
                providerName: dispatchResult.providerName,
                providerMessageId: dispatchResult.providerMessageId,
              },
            });

            // Record a RENEWAL_EVENT that a reminder was sent
            await this.prisma.renewalEvent.create({
              data: {
                assetId: asset.id,
                eventType: 'REMINDER_SENT',
                eventDate: new Date(),
                notes: `${channel} reminder sent to ${recipient.email} (${notifType})`,
              },
            });

            result.sent++;
            result.details.push(`✅ ${channel} → ${recipient.email} — ${asset.name} (${notifType})`);
          } else {
            await this.prisma.notification.update({
              where: { id: notification.id },
              data: {
                status: NotificationStatus.FAILED,
                failedAt: new Date(),
                failureReason: dispatchResult.error,
              },
            });
            result.failed++;
            result.details.push(
              `❌ ${channel} → ${recipient.email} — ${asset.name}: ${dispatchResult.error}`,
            );
          }
        }
      }
    }

    const elapsed = Date.now() - startedAt;
    this.logger.log(
      `Daily reminders complete: processed=${result.processed} sent=${result.sent} skipped=${result.skipped} failed=${result.failed} (${elapsed}ms)`,
    );

    return result;
  }

  private collectRecipients(asset: any): RecipientInfo[] {
    const recipients = new Map<string, RecipientInfo>();

    // Asset's assigned user (if any)
    if (asset.assignedUser) {
      recipients.set(asset.assignedUser.id, {
        id: asset.assignedUser.id,
        email: asset.assignedUser.email,
        fullName: asset.assignedUser.fullName,
        phoneNumber: asset.assignedUser.phoneNumber,
      });
    }

    // All active org members (OWNER, ADMIN, MEMBER)
    for (const member of asset.organization.members) {
      if (member.user?.deletedAt) continue;
      if (!recipients.has(member.user.id)) {
        recipients.set(member.user.id, {
          id: member.user.id,
          email: member.user.email,
          fullName: member.user.fullName,
          phoneNumber: member.user.phoneNumber,
        });
      }
    }

    return Array.from(recipients.values());
  }

  private buildNotificationType(daysUntil: number): string {
    if (daysUntil < 0) return `EXPIRED_${Math.abs(daysUntil)}D`;
    if (daysUntil === 0) return 'EXPIRED_0D';
    return `REMINDER_${daysUntil}D`;
  }

  /**
   * Credit cards are monthly recurring — when the due day passes, roll the asset's
   * renewalDate forward by its interval (usually +1 month) until it's in the future.
   * This re-arms the reminder pipeline for next month automatically.
   */
  private async rollForwardOverdueCreditCards(today: Date): Promise<void> {
    const overdueCards = await this.prisma.asset.findMany({
      where: {
        deletedAt: null,
        assetType: 'CREDIT_CARD',
        status: { in: ['ACTIVE', 'EXPIRING_SOON', 'EXPIRED'] },
        renewalDate: { lt: today },
        organization: { deletedAt: null, status: 'ACTIVE' },
      },
      select: {
        id: true,
        renewalDate: true,
        renewalIntervalUnit: true,
        renewalIntervalValue: true,
      },
    });

    for (const card of overdueCards) {
      let nextDate = card.renewalDate;
      const unit = card.renewalIntervalUnit ?? 'month';
      const value = card.renewalIntervalValue ?? 1;
      // Advance until the date is in the future — handles multiple missed cycles.
      let safety = 0;
      while (nextDate < today && safety++ < 24) {
        nextDate = addInterval(nextDate, unit, value);
      }
      const status = getExpiryStatus(daysUntilExpiry(nextDate));

      await this.prisma.$transaction(async (tx) => {
        await tx.asset.update({
          where: { id: card.id },
          data: { renewalDate: nextDate, status, lastRenewedAt: new Date() },
        });
        await tx.renewalEvent.create({
          data: {
            assetId: card.id,
            eventType: RenewalEventType.RENEWED,
            oldRenewalDate: card.renewalDate,
            newRenewalDate: nextDate,
            notes: 'Monthly auto-advance (credit card due date passed)',
          },
        });
      });

      this.logger.log(
        `Credit card ${card.id} advanced: ${card.renewalDate.toISOString().slice(0, 10)} → ${nextDate.toISOString().slice(0, 10)}`,
      );
    }
  }
}
