import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/db/prisma.service';

// Lazy-loaded so the module is happy in environments where web-push is
// missing (e.g. when running migrations only).
type WebPushModule = typeof import('web-push');

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export interface SendResult {
  attempted: number;
  succeeded: number;
  failedExpired: number;
  failedOther: number;
}

/**
 * Wraps the `web-push` library + the WebPushSubscription table.
 *
 * Responsibilities:
 *  - Configure VAPID details from env on boot
 *  - Send a payload to all of a user's subscriptions in parallel
 *  - Auto-prune subscriptions that the browser has invalidated (HTTP 404/410)
 */
@Injectable()
export class WebPushService implements OnModuleInit {
  private readonly logger = new Logger(WebPushService.name);
  private webpush: WebPushModule | null = null;
  private configured = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:noreply@renewpilot.io';

    if (!publicKey || !privateKey) {
      this.logger.warn('VAPID keys not set — web push disabled (subscribe/send no-ops).');
      return;
    }

    try {
      // Lazy require so the dependency is optional at runtime.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.webpush = require('web-push');
      this.webpush!.setVapidDetails(subject, publicKey, privateKey);
      this.configured = true;
      this.logger.log('Web push configured with VAPID keys');
    } catch (err: any) {
      this.logger.error(`Failed to init web-push: ${err.message}`);
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getPublicKey(): string | null {
    return this.config.get<string>('VAPID_PUBLIC_KEY') ?? null;
  }

  /**
   * Send to every subscription belonging to a user.
   * Returns counts so the caller can record success/failure on the
   * Notification row.
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<SendResult> {
    const result: SendResult = {
      attempted: 0,
      succeeded: 0,
      failedExpired: 0,
      failedOther: 0,
    };

    if (!this.configured || !this.webpush) {
      this.logger.warn(`[PUSH STUB] user=${userId} title="${payload.title}"`);
      return result;
    }

    const subs = await this.prisma.webPushSubscription.findMany({
      where: { userId },
    });

    if (subs.length === 0) return result;

    result.attempted = subs.length;
    const json = JSON.stringify(payload);

    // Fan out in parallel; track expired endpoints so we can prune.
    const expiredIds: string[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await this.webpush!.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            json,
            { TTL: 60 * 60 * 12 }, // 12h
          );
          result.succeeded += 1;
          // Mark this sub as recently used (best-effort, don't await).
          this.prisma.webPushSubscription
            .update({ where: { id: sub.id }, data: { lastUsedAt: new Date() } })
            .catch(() => undefined);
        } catch (err: any) {
          const status = err?.statusCode ?? err?.status;
          // 404/410 = endpoint is gone. Drop it.
          if (status === 404 || status === 410) {
            expiredIds.push(sub.id);
            result.failedExpired += 1;
          } else {
            result.failedOther += 1;
            this.logger.warn(
              `Push send failed for sub ${sub.id} (status=${status}): ${err?.body ?? err?.message}`,
            );
          }
        }
      }),
    );

    if (expiredIds.length > 0) {
      await this.prisma.webPushSubscription.deleteMany({
        where: { id: { in: expiredIds } },
      });
      this.logger.log(`Pruned ${expiredIds.length} expired push subscription(s) for user ${userId}`);
    }

    return result;
  }
}
